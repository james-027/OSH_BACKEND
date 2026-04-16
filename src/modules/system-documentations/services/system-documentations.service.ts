import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemDocumentation } from "../../../entities/SystemDocumentation";
import { System } from "../../../entities/System";
import { Status } from "../../../entities/Status";
import { User } from "../../../entities/User";
import { CreateSystemDocumentationDto } from "../dto/CreateSystemDocumentationDto";
import { UpdateSystemDocumentationDto } from "../dto/UpdateSystemDocumentationDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class SystemDocumentationsService {
  constructor(
    @InjectRepository(SystemDocumentation)
    private systemDocumentationRepository: Repository<SystemDocumentation>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditTrailService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findSystemByAbbr(system_abbr: string): Promise<System | null> {
    try {
      const system = await this.systemRepository.findOne({
        where: { system_abbr: system_abbr.toUpperCase() },
      });
      return system || null;
    } catch (error) {
      logger.error("Error finding system by abbreviation:", error);
      throw new BadRequestException("Failed to find system");
    }
  }

  async findAll(): Promise<any[]> {
    try {
      const documentations = await this.systemDocumentationRepository.find({
        relations: ["system", "status", "createdBy", "updatedBy"],
        order: { id: "ASC" },
      });

      return documentations.map((doc) => this.createFlattenedResponse(doc));
    } catch (error) {
      logger.error("Error fetching system documentations:", error);
      throw new Error("Failed to fetch system documentations");
    }
  }

  async findAllBySystemId(system_id: number): Promise<any[]> {
    try {
      const documentations = await this.systemDocumentationRepository.find({
        where: { system_id },
        relations: ["system", "status", "createdBy", "updatedBy"],
        order: { id: "ASC" },
      });

      return documentations.map((doc) => this.createFlattenedResponse(doc));
    } catch (error) {
      logger.error("Error fetching system documentations:", error);
      throw new Error("Failed to fetch system documentations");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const documentation = await this.systemDocumentationRepository.findOne({
        where: { id },
        relations: ["system", "status", "createdBy", "updatedBy"],
      });

      if (!documentation) {
        throw new NotFoundException(
          `System documentation with ID ${id} not found`,
        );
      }

      return this.createFlattenedResponse(documentation);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error fetching system documentation:", error);
      throw new Error("Failed to fetch system documentation");
    }
  }

  async create(
    createDto: CreateSystemDocumentationDto,
    userId: number,
  ): Promise<any> {
    try {
      // Validate system exists
      const system = await this.systemRepository.findOne({
        where: { id: createDto.system_id },
      });
      if (!system) {
        throw new BadRequestException(
          `System with ID ${createDto.system_id} not found`,
        );
      }

      // Validate user exists
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Validate status
      const status = await this.statusRepository.findOne({
        where: { id: createDto.status_id || 1 },
      });
      if (!status) {
        throw new BadRequestException(
          `Status with ID ${createDto.status_id || 1} not found`,
        );
      }

      // Create documentation
      const newDocumentation = this.systemDocumentationRepository.create({
        ...createDto,
        status_id: createDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const saved =
        await this.systemDocumentationRepository.save(newDocumentation);

      // Audit trail
      await this.auditTrailService.create(
        {
          service: "SystemDocumentationsService",
          method: "create",
          raw_data: JSON.stringify(createDto),
          description: `Created system documentation: ${createDto.file_name} for system ID: ${createDto.system_id}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("system_documentations", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return this.createFlattenedResponse(saved);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error creating system documentation:", error);
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Failed to create system documentation",
      );
    }
  }

  async update(
    id: number,
    updateDto: UpdateSystemDocumentationDto,
    userId: number,
  ): Promise<any> {
    try {
      const documentation = await this.systemDocumentationRepository.findOne({
        where: { id },
      });
      if (!documentation) {
        throw new NotFoundException(
          `System documentation with ID ${id} not found`,
        );
      }

      // Validate system if being updated
      if (updateDto.system_id) {
        const system = await this.systemRepository.findOne({
          where: { id: updateDto.system_id },
        });
        if (!system) {
          throw new BadRequestException(
            `System with ID ${updateDto.system_id} not found`,
          );
        }
      }

      // Validate status if being updated
      if (updateDto.status_id) {
        const status = await this.statusRepository.findOne({
          where: { id: updateDto.status_id },
        });
        if (!status) {
          throw new BadRequestException(
            `Status with ID ${updateDto.status_id} not found`,
          );
        }
      }

      // If file_path is being updated, optionally delete old file
      if (
        updateDto.file_path &&
        updateDto.file_path !== documentation.file_path
      ) {
        try {
          const oldFilePath = path.join(process.cwd(), documentation.file_path);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (err) {
          logger.warn("Could not delete old file:", err);
        }
      }

      // Update documentation
      Object.assign(documentation, updateDto, {
        updated_by: userId,
      });

      const saved =
        await this.systemDocumentationRepository.save(documentation);

      // Audit trail
      await this.auditTrailService.create(
        {
          service: "SystemDocumentationsService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated system documentation ID: ${id}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("system_documentations", id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return this.createFlattenedResponse(saved);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error updating system documentation:", error);
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Failed to update system documentation",
      );
    }
  }

  async toggleStatus(
    id: number,
    userId: number,
    status_id: number,
  ): Promise<any> {
    try {
      const documentation = await this.systemDocumentationRepository.findOne({
        where: { id },
      });
      if (!documentation) {
        throw new NotFoundException(
          `System documentation with ID ${id} not found`,
        );
      }

      // Validate status
      const status = await this.statusRepository.findOne({
        where: { id: status_id },
      });
      if (!status) {
        throw new BadRequestException(`Status with ID ${status_id} not found`);
      }

      await this.systemDocumentationRepository.update(id, {
        status_id,
        updated_by: userId,
      });

      // Audit trail
      await this.auditTrailService.create(
        {
          service: "SystemDocumentationsService",
          method: "toggleStatus",
          raw_data: JSON.stringify({ id, status_id }),
          description: `Toggled status for system documentation ID: ${id} to ${status.status_name}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("system_documentations", id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return this.findOne(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error toggling system documentation status:", error);
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Failed to toggle system documentation status",
      );
    }
  }

  private createFlattenedResponse(documentation: SystemDocumentation): any {
    return {
      id: documentation.id,
      system_id: documentation.system_id,
      system_name: documentation.system
        ? documentation.system.system_name
        : null,
      system_abbr: documentation.system
        ? documentation.system.system_abbr
        : null,
      file_name: documentation.file_name,
      file_path: documentation.file_path,
      status_id: documentation.status_id,
      status_name: documentation.status
        ? documentation.status.status_name
        : null,
      created_by: documentation.created_by,
      created_at: documentation.created_at,
      updated_by: documentation.updated_by,
      modified_at: documentation.modified_at,
      created_user: documentation.createdBy
        ? `${documentation.createdBy.first_name} ${documentation.createdBy.last_name}`
        : null,
      updated_user: documentation.updatedBy
        ? `${documentation.updatedBy.first_name} ${documentation.updatedBy.last_name}`
        : null,
    };
  }
}
