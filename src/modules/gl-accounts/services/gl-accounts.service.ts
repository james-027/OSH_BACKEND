import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { GLAccounts } from "src/entities/GLAccounts";

import { CreateGlAccountDto } from "../dto/CreateGlAccountDto";
import { UpdateGlAccountDto } from "../dto/UpdateGlAccountsDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "../../../config/logger";

import { User } from "src/entities/User";
import { Status } from "src/entities/Status";

@Injectable()
export class GlAccountsService {
  constructor(
    @InjectRepository(GLAccounts)
    private GlAccountsRepository: Repository<GLAccounts>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  private mapResponse(data: GLAccounts) {
    return {
      id: data.id,
      gl_code: data.gl_code,
      gl_name: data.gl_name,
      old_code: data.old_code,
      company: data.company,

      status_id: data.status_id,

      status_name: data.status ? data.status.status_name : null,

      created_at: data.created_at,
      updated_at: data.updated_at,

      created_by: data.created_by,
      updated_by: data.updated_by,
    };
  }

  // Get all GL accounts
  async findAll(): Promise<any[]> {
    try {
      const GlAccounts = await this.GlAccountsRepository.find({
        relations: ["status"],
      });

      return GlAccounts.map((gl) => this.mapResponse(gl));
    } catch (error) {
      logger.error("Error fetching  GL accounts:", error);

      throw new Error("Failed to fetch  GL accounts");
    }
  }

  // Get single GL account
  async findOne(id: number): Promise<any> {
    try {
      const GlAccount = await this.GlAccountsRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!GlAccount) {
        throw new NotFoundException(` GL account with ID ${id} not found`);
      }

      return this.mapResponse(GlAccount);
    } catch (error) {
      logger.error("Error fetching  GL account:", error);

      throw error;
    }
  }

  // Create GL account
  async create(
    createGlAccountDto: CreateGlAccountDto,
    userId: number,
  ): Promise<any> {
    const { status_id } = createGlAccountDto;

    try {
      const existingGlAccount =
        await this.GlAccountsRepository.findOne({
          where: {
            gl_code: createGlAccountDto.gl_code,
          },
        });

      if (existingGlAccount) {
        throw new BadRequestException(" GL code already exists");
      }

      const resolvedStatusId = status_id || 1;

      const statusEntity = await this.statusRepository.findOneBy({
        id: resolvedStatusId,
      });

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

      const newGlAccount = this.GlAccountsRepository.create({
        gl_code: createGlAccountDto.gl_code,

        gl_name: createGlAccountDto.gl_name,

        old_code: createGlAccountDto.old_code || null,

        company: createGlAccountDto.company || null,

        status_id: resolvedStatusId,
        status: statusEntity,

        created_by: userId,
      });

      const savedGlAccount =
        await this.GlAccountsRepository.save(newGlAccount);

      await this.userAuditTrailCreateService.create(
        {
          service: "_GL_ACCOUNT",
          method: "CREATE",
          raw_data: JSON.stringify(savedGlAccount),
          description: `Created  GL account: ${savedGlAccount.gl_code}`,
          status_id: 1,
        },
        userId,
      );

      this.sseEventEmitter.emitCreateSignal(
        "-gl-account",
        savedGlAccount.id,
      );

      return this.mapResponse(savedGlAccount);
    } catch (error) {
      logger.error("Error creating  GL account:", error);

      throw error;
    }
  }

  // Update GL account
  async update(
    id: number,
    updateGlAccountDto: UpdateGlAccountDto,
    userId: number,
  ): Promise<any> {
    try {
      const GlAccount = await this.GlAccountsRepository.findOne({
        where: { id },
      });

      if (!GlAccount) {
        throw new NotFoundException(` GL account with ID ${id} not found`);
      }

      if (
        updateGlAccountDto.gl_code &&
        updateGlAccountDto.gl_code !== GlAccount.gl_code
      ) {
        const existing = await this.GlAccountsRepository.findOne({
          where: {
            gl_code: updateGlAccountDto.gl_code,
          },
        });

        if (existing) {
          throw new BadRequestException(" GL code already exists");
        }
      }

      Object.assign(GlAccount, {
        gl_code: updateGlAccountDto.gl_code || GlAccount.gl_code,

        gl_name: updateGlAccountDto.gl_name || GlAccount.gl_name,

        old_code: updateGlAccountDto.old_code || GlAccount.old_code,

        company: updateGlAccountDto.company || GlAccount.company,

        updated_by: userId,
      });

      await this.GlAccountsRepository.save(GlAccount);

      const updatedGlAccount =
        await this.GlAccountsRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      await this.userAuditTrailCreateService.create(
        {
          service: "_GL_ACCOUNT",
          method: "EDIT",
          raw_data: JSON.stringify(updatedGlAccount),
          description: `Updated  GL account: ${updatedGlAccount.gl_code}`,
          status_id: updatedGlAccount.status_id || 1,
        },
        userId,
      );

      this.sseEventEmitter.emitUpdateSignal(
        "-gl-account",
        updatedGlAccount.id,
      );

      return this.mapResponse(updatedGlAccount);
    } catch (error) {
      logger.error("Error updating  GL account:", error);

      throw error;
    }
  }

  // Soft delete
  async delete(id: number, userId: number): Promise<void> {
    try {
      const GlAccount = await this.GlAccountsRepository.findOne({
        where: { id },
      });

      if (!GlAccount) {
        throw new NotFoundException(` GL account with ID ${id} not found`);
      }

      GlAccount.status_id = 14;

      await this.GlAccountsRepository.save(GlAccount);

      await this.userAuditTrailCreateService.create(
        {
          service: "_GL_ACCOUNT",
          method: "DELETE",
          raw_data: JSON.stringify(GlAccount),
          description: `Deleted  GL account: ${GlAccount.gl_code}`,
          status_id: 14,
        },
        userId,
      );

      this.sseEventEmitter.emitDeleteSignal("-gl-account", id);
    } catch (error) {
      logger.error("Error deleting  GL account:", error);

      throw error;
    }
  }

  // Toggle status
  async toggleStatus(id: number, userId: number) {
    const GlAccount = await this.GlAccountsRepository.findOne({
      where: { id },
    });

    if (!GlAccount) {
      throw new NotFoundException(" GL account not found.");
    }

    const newStatusId = GlAccount.status_id === 1 ? 14 : 1;

    const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });

    if (!newStatusEntity) {
      throw new Error("Target status not found.");
    }

    GlAccount.status = newStatusEntity;

    GlAccount.status_id = newStatusEntity.id;

    GlAccount.updated_by = userId;

    const updatedGlAccount =
      await this.GlAccountsRepository.save(GlAccount);

    await this.userAuditTrailCreateService.create(
      {
        service: "_GL_ACCOUNT",
        method: "TOGGLE_STATUS",
        raw_data: JSON.stringify(updatedGlAccount),
        description: `Toggled  GL account: ${updatedGlAccount.gl_code}`,
        status_id: updatedGlAccount.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdateSignal(
      "-gl-account",
      updatedGlAccount.id,
    );

    return {
      message: ` GL account ${updatedGlAccount.gl_code} successfully toggled ${
        newStatusId === 1 ? "to active" : "to deleted"
      }.`,
      _gl_account: {
        ...updatedGlAccount,
        status_name: updatedGlAccount.status
          ? updatedGlAccount.status.status_name
          : null,
      },
    };
  }
}
