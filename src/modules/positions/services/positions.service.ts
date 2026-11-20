import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Position } from "src/entities/Position";
import { UsersService } from "src/modules/users/services/users.service";
import { CreatePositionDto } from "../dto/CreatePositionDto";
import { UpdatePositionDto } from "../dto/UpdatePositionDto";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "src/modules/users/dto/CreateUserAuditTrailDto";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private positionsRepository: Repository<Position>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accessKeyId?: number): Promise<any[]> {
    const where: any = {};
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }

    const positions = await this.positionsRepository.find({
      where,
      relations: ["status", "createdBy", "updatedBy", "accessKey"],
    });
    return positions.map((position) => ({
      id: position.id,
      position_name: position.position_name,
      position_abbr: position.position_abbr,
      status_id: position.status_id,
      access_key_id: position.access_key_id,
      access_key_name: position.accessKey
        ? position.accessKey.access_key_name
        : null,
      created_at: position.created_at,
      created_by: position.created_by,
      updated_by: position.updated_by,
      modified_at: position.modified_at,
      status_name: position.status ? position.status.status_name : null,
      created_user: position.createdBy
        ? `${position.createdBy.first_name} ${position.createdBy.last_name}`
        : null,
      updated_user: position.updatedBy
        ? `${position.updatedBy.first_name} ${position.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number, accessKeyId?: number): Promise<any> {
    const where: any = { id };
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }

    const position = await this.positionsRepository.findOne({
      where,
      relations: ["status", "createdBy", "updatedBy", "accessKey"],
    });
    if (!position)
      throw new NotFoundException(`Position with ID ${id} not found`);
    return {
      id: position.id,
      position_name: position.position_name,
      position_abbr: position.position_abbr,
      status_id: position.status_id,
      access_key_id: position.access_key_id,
      access_key_name: position.accessKey
        ? position.accessKey.access_key_name
        : null,
      created_at: position.created_at,
      created_by: position.created_by,
      updated_by: position.updated_by,
      modified_at: position.modified_at,
      status_name: position.status ? position.status.status_name : null,
      created_user: position.createdBy
        ? `${position.createdBy.first_name} ${position.createdBy.last_name}`
        : null,
      updated_user: position.updatedBy
        ? `${position.updatedBy.first_name} ${position.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createPositionDto: CreatePositionDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    const effectiveAccessKeyId =
      createPositionDto.access_key_id || accessKeyId;

    const existingWhere: any = {
      position_name: createPositionDto.position_name,
    };
    if (effectiveAccessKeyId !== undefined) {
      existingWhere.access_key_id = effectiveAccessKeyId;
    }

    const existing = await this.positionsRepository.findOne({
      where: existingWhere,
    });
    if (existing)
      throw new BadRequestException(
        "Position with this name already exists for this access key",
      );
    const createdByUser = await this.usersService.findUserById(userId);
    if (!createdByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    const newPosition = this.positionsRepository.create({
      position_name: createPositionDto.position_name,
      position_abbr: createPositionDto.position_abbr,
      status_id: createPositionDto.status_id || 1,
      access_key_id: effectiveAccessKeyId,
      created_by: userId,
      updated_by: userId,
    });
    const savedPosition = await this.positionsRepository.save(newPosition);
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "PositionsService",
        method: "create",
        raw_data: JSON.stringify(savedPosition),
        description: `Created position ${savedPosition.id} - ${savedPosition.position_name}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal("positions", savedPosition.id);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }
    return this.findOne(savedPosition.id, effectiveAccessKeyId);
  }

  async update(
    id: number,
    updatePositionDto: UpdatePositionDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    const position = await this.positionsRepository.findOne({
      where:
        accessKeyId !== undefined ? { id, access_key_id: accessKeyId } : { id },
    });
    if (!position)
      throw new NotFoundException(`Position with ID ${id} not found`);

    const effectiveAccessKeyId =
      updatePositionDto.access_key_id !== undefined
        ? updatePositionDto.access_key_id
        : position.access_key_id;

    if (updatePositionDto.position_name) {
      const existingWhere: any = {
        position_name: updatePositionDto.position_name,
      };
      if (effectiveAccessKeyId !== undefined) {
        existingWhere.access_key_id = effectiveAccessKeyId;
      }
      const existing = await this.positionsRepository.findOne({
        where: existingWhere,
      });
      if (existing && existing.id !== id)
        throw new BadRequestException(
          "Position with this name already exists for this access key",
        );
    }
    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    await this.positionsRepository.update(id, {
      ...updatePositionDto,
      updated_by: userId,
    });
    // Audit trail
    const updatedPosition = await this.findOne(id, effectiveAccessKeyId);
    await this.userAuditTrailCreateService.create(
      {
        service: "PositionsService",
        method: "update",
        raw_data: JSON.stringify(updatedPosition),
        description: `Updated position ${id} - ${updatedPosition.position_name}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("positions", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return updatedPosition;
  }

  async remove(id: number, accessKeyId?: number): Promise<void> {
    const where: any = { id };
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }
    const position = await this.positionsRepository.findOne({ where });
    if (!position)
      throw new NotFoundException(`Position with ID ${id} not found`);
    await this.positionsRepository.remove(position);
  }

  async toggleStatus(
    id: number,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    const where: any = { id };
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }
    const position = await this.positionsRepository.findOne({ where });
    if (!position) {
      throw new NotFoundException(`Position with ID ${id} not found`);
    }
    const newStatusId = position.status_id === 1 ? 2 : 1;
    const newStatusName = newStatusId === 1 ? "Active" : "Inactive";
    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    await this.positionsRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });
    // Audit trail
    const toggledPosition = await this.findOne(id, accessKeyId);
    await this.userAuditTrailCreateService.create(
      {
        service: "PositionsService",
        method: "toggleStatus",
        raw_data: JSON.stringify(toggledPosition),
        description: `Toggled status for position ${id} to ${newStatusName}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("positions", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return toggledPosition;
  }
}
