import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Segment } from "src/entities/Segment";
import { UsersService } from "src/modules/users/services/users.service";
import { CreateSegmentDto } from "../dto/CreateSegmentDto";
import { UpdateSegmentDto } from "../dto/UpdateSegmentDto";
import { ResponseMapperService } from "src/services/response-mapper.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment)
    private segmentsRepository: Repository<Segment>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    const segments = await this.segmentsRepository.find({
      relations: ["status", "createdBy", "updatedBy", "brand"],
    });
    return segments.map((segment) => ({
      id: segment.id,
      segment_name: segment.segment_name,
      segment_abbr: segment.segment_abbr,
      status_id: segment.status_id,
      created_at: segment.created_at,
      created_by: segment.created_by,
      updated_by: segment.updated_by,
      modified_at: segment.modified_at,
      status_name: segment.status ? segment.status.status_name : null,
      created_user: segment.createdBy
        ? `${segment.createdBy.first_name} ${segment.createdBy.last_name}`
        : null,
      updated_user: segment.updatedBy
        ? `${segment.updatedBy.first_name} ${segment.updatedBy.last_name}`
        : null,
      brand_id: segment.brand_id,
      brand_name: segment.brand ? segment.brand.brand_name : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const segment = await this.segmentsRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy", "brand"],
    });
    if (!segment)
      throw new NotFoundException(`Segment with ID ${id} not found`);
    return {
      id: segment.id,
      segment_name: segment.segment_name,
      segment_abbr: segment.segment_abbr,
      status_id: segment.status_id,
      created_at: segment.created_at,
      created_by: segment.created_by,
      updated_by: segment.updated_by,
      modified_at: segment.modified_at,
      status_name: segment.status ? segment.status.status_name : null,
      created_user: segment.createdBy
        ? `${segment.createdBy.first_name} ${segment.createdBy.last_name}`
        : null,
      updated_user: segment.updatedBy
        ? `${segment.updatedBy.first_name} ${segment.updatedBy.last_name}`
        : null,
      brand_id: segment.brand_id,
      brand_name: segment.brand ? segment.brand.brand_name : null,
    };
  }

  async create(
    createSegmentDto: CreateSegmentDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingSegment = await this.segmentsRepository.findOne({
        where: {
          segment_name: createSegmentDto.segment_name,
        },
      });

      if (existingSegment) {
        throw new BadRequestException("Segment with this name already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);

      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newSegment = this.segmentsRepository.create({
        segment_name: createSegmentDto.segment_name,
        segment_abbr: createSegmentDto.segment_abbr,
        brand_id: createSegmentDto.brand_id,
        status_id: createSegmentDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedSegment = await this.segmentsRepository.save(newSegment);

      const segmentWithRelations = await this.segmentsRepository.findOne({
        where: { id: savedSegment.id },
        relations: ["status", "createdBy", "updatedBy", "brand"],
      });

      if (!segmentWithRelations) {
        throw new Error("Failed to retrieve created segment");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SegmentsService",
          method: "create",
          raw_data: JSON.stringify(segmentWithRelations),
          description: `Created segment ${segmentWithRelations.segment_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(segmentWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("segments", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to create segment",
        error: err,
      });
    }
  }

  async update(
    id: number,
    updateDto: UpdateSegmentDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingSegment = await this.segmentsRepository.findOne({
        where: { id },
      });

      if (!existingSegment) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateDto.segment_name) {
        const duplicateSegment = await this.segmentsRepository.findOne({
          where: {
            segment_name: updateDto.segment_name,
          },
        });

        if (duplicateSegment && duplicateSegment.id !== id) {
          throw new BadRequestException(
            "Segment with this name already exists",
          );
        }
      }

      await this.segmentsRepository.update(id, {
        ...updateDto,
        updated_by: userId,
      });

      const segmentWithRelations = await this.segmentsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy","brand"],
      });

      if (!segmentWithRelations) {
        throw new Error("Failed to retrieve updated segment");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SegmentsService",
          method: "update",
          raw_data: JSON.stringify(segmentWithRelations),
          description: `Updated segment ${segmentWithRelations.segment_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(segmentWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("segments", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to update segment",
        error: err,
      });
    }
  }

  async remove(id: number): Promise<void> {
    const segment = await this.segmentsRepository.findOne({ where: { id } });
    if (!segment)
      throw new NotFoundException(`Segment with ID ${id} not found`);
    await this.segmentsRepository.remove(segment);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const segment = await this.segmentsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!segment) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStatusId = segment.status_id === 1 ? 2 : 1;

      await this.segmentsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      const updatedSegment = await this.segmentsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedSegment) {
        throw new Error("Failed to retrieve updated segment");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SegmentsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedSegment),
          description: `${
            newStatusId === 1 ? "Activated" : "Deactivated"
          } segment ${updatedSegment.segment_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedSegment);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("segments", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to toggle segment status",
        error: err,
      });
    }
  }
}
