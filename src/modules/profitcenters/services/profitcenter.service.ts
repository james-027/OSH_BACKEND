import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { Profitcenter } from "src/entities/Profitcenter";

import { User } from "src/entities/User";

import { Status } from "src/entities/Status";

import { CreateProfitcenterDto } from "../dto/CreateProfitcenterDto";

import { UpdateProfitcenterDto } from "../dto/UpdateProfitcenterDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ResponseMapperService } from "../../../services/response-mapper.service";

import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "../../../config/logger";

@Injectable()
export class ProfitcenterService {
  constructor(
    @InjectRepository(Profitcenter)
    private profitcenterRepository: Repository<Profitcenter>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,

    private responseMapperService: ResponseMapperService,

    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  // Get all profit centers
  async findAll(): Promise<any[]> {
    try {
      const profitcenters =
        await this.profitcenterRepository.find({
          relations: ["status"],
        });

      return profitcenters.map(
        (profitcenter) => ({
          id: profitcenter.id,

          profitcenter_code:
            profitcenter.profitcenter_code,

          profitcenter_name:
            profitcenter.profitcenter_name,

          old_code:
            profitcenter.old_code,

          status_id:
            profitcenter.status_id,

          status_name:
            profitcenter.status
              ? profitcenter.status
                  .status_name
              : null,

          created_at:
            profitcenter.created_at,

          updated_at:
            profitcenter.updated_at,

          created_by:
            profitcenter.created_by,
        }),
      );
    } catch (error) {
      logger.error(
        "Error fetching profit centers:",
        error,
      );

      throw new Error(
        "Failed to fetch profit centers",
      );
    }
  }

  // Get single profit center
  async findOne(id: number): Promise<any> {
    try {
      const profitcenter =
        await this.profitcenterRepository.findOne(
          {
            where: { id },

            relations: ["status"],
          },
        );

      if (!profitcenter) {
        throw new NotFoundException(
          `Profitcenter with ID ${id} not found`,
        );
      }

      return {
        id: profitcenter.id,

        profitcenter_code:
          profitcenter.profitcenter_code,

        profitcenter_name:
          profitcenter.profitcenter_name,

        old_code:
          profitcenter.old_code,

        status_id:
          profitcenter.status_id,

        status_name:
          profitcenter.status
            ? profitcenter.status
                .status_name
            : null,

        created_at:
          profitcenter.created_at,

        updated_at:
          profitcenter.updated_at,

        created_by:
          profitcenter.created_by,
      };
    } catch (error) {
      logger.error(
        "Error fetching profit center:",
        error,
      );

      throw error;
    }
  }

  // Create profit center
  async create(
    createProfitcenterDto: CreateProfitcenterDto,
    userId: number,
  ): Promise<any> {
    const { status_id } =
      createProfitcenterDto;

    try {
      const existingProfitcenter =
        await this.profitcenterRepository.findOne(
          {
            where: {
              profitcenter_code:
                createProfitcenterDto.profitcenter_code,
            },
          },
        );

      if (existingProfitcenter) {
        throw new BadRequestException(
          "Profit center code already exists",
        );
      }

      const resolvedStatusId =
        status_id || 1;

      const statusEntity =
        await this.statusRepository.findOneBy(
          {
            id: resolvedStatusId,
          },
        );

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

      const newProfitcenter =
        this.profitcenterRepository.create({
          profitcenter_code:
            createProfitcenterDto.profitcenter_code,

          profitcenter_name:
            createProfitcenterDto.profitcenter_name ||
            null,

          old_code:
            createProfitcenterDto.old_code ||
            null,

          status_id:
            resolvedStatusId,

          status: statusEntity,

          created_by: userId,
        });

      const savedProfitcenter =
        await this.profitcenterRepository.save(
          newProfitcenter,
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "PROFITCENTER",

          method: "CREATE",

          raw_data: JSON.stringify(
            savedProfitcenter,
          ),

          description: `Created profit center: ${savedProfitcenter.profitcenter_code}`,

          status_id: 1,
        },
        userId,
      );

      this.sseEventEmitter.emitCreateSignal(
        "profitcenters",
        savedProfitcenter.id,
      );

      return {
        id: savedProfitcenter.id,

        profitcenter_code:
          savedProfitcenter.profitcenter_code,

        profitcenter_name:
          savedProfitcenter.profitcenter_name,

        old_code:
          savedProfitcenter.old_code,

        status_id:
          savedProfitcenter.status_id,

        status_name:
          savedProfitcenter.status
            ? savedProfitcenter.status
                .status_name
            : null,

        created_at:
          savedProfitcenter.created_at,

        updated_at:
          savedProfitcenter.updated_at,

        created_by:
          savedProfitcenter.created_by,
      };
    } catch (error) {
      logger.error(
        "Error creating profit center:",
        error,
      );

      throw error;
    }
  }

  // Update profit center
  async update(
    id: number,
    updateProfitcenterDto: UpdateProfitcenterDto,
    userId: number,
  ): Promise<any> {
    try {
      const profitcenter =
        await this.profitcenterRepository.findOne(
          {
            where: { id },
          },
        );

      if (!profitcenter) {
        throw new NotFoundException(
          `Profitcenter with ID ${id} not found`,
        );
      }

      if (
        updateProfitcenterDto.profitcenter_code &&
        updateProfitcenterDto.profitcenter_code !==
          profitcenter.profitcenter_code
      ) {
        const existing =
          await this.profitcenterRepository.findOne(
            {
              where: {
                profitcenter_code:
                  updateProfitcenterDto.profitcenter_code,
              },
            },
          );

        if (existing) {
          throw new BadRequestException(
            "Profit center code already exists",
          );
        }
      }

      Object.assign(profitcenter, {
        profitcenter_code:
          updateProfitcenterDto.profitcenter_code ||
          profitcenter.profitcenter_code,

        profitcenter_name:
          updateProfitcenterDto.profitcenter_name ||
          profitcenter.profitcenter_name,

        old_code:
          updateProfitcenterDto.old_code ||
          profitcenter.old_code,
      });

      await this.profitcenterRepository.save(
        profitcenter,
      );

      const updatedProfitcenter =
        await this.profitcenterRepository.findOne(
          {
            where: { id },

            relations: ["status"],
          },
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "PROFITCENTER",

          method: "EDIT",

          raw_data: JSON.stringify(
            updatedProfitcenter,
          ),

          description: `Updated profit center: ${updatedProfitcenter.profitcenter_code}`,

          status_id:
            updatedProfitcenter.status_id ||
            1,
        },
        userId,
      );

      this.sseEventEmitter.emitUpdateSignal(
        "profitcenters",
        updatedProfitcenter.id,
      );

      return {
        ...updatedProfitcenter,

        status_name:
          updatedProfitcenter.status
            ? updatedProfitcenter.status
                .status_name
            : null,
      };
    } catch (error) {
      logger.error(
        "Error updating profit center:",
        error,
      );

      throw error;
    }
  }

  // Toggle status
  async toggleStatus(
    id: number,
    userId: number,
  ) {
    const profitcenter =
      await this.profitcenterRepository.findOne(
        {
          where: { id },
        },
      );

    if (!profitcenter) {
      throw new NotFoundException(
        "Profit center not found.",
      );
    }

    const newStatusId =
      profitcenter.status_id === 1
        ? 14
        : 1;

    const newStatusEntity =
      await this.statusRepository.findOneBy(
        {
          id: newStatusId,
        },
      );

    if (!newStatusEntity) {
      throw new Error(
        "Target status not found.",
      );
    }

    profitcenter.status =
      newStatusEntity;

    profitcenter.status_id =
      newStatusEntity.id;

    const updatedProfitcenter =
      await this.profitcenterRepository.save(
        profitcenter,
      );

    await this.userAuditTrailCreateService.create(
      {
        service: "PROFITCENTER",

        method: "TOGGLE_STATUS",

        raw_data: JSON.stringify(
          updatedProfitcenter,
        ),

        description: `Toggled profit center: ${updatedProfitcenter.profitcenter_code}`,

        status_id:
          updatedProfitcenter.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdateSignal(
      "profitcenters",
      updatedProfitcenter.id,
    );

    return {
      message: `Profit center ${updatedProfitcenter.profitcenter_code} successfully toggled ${
        newStatusId === 1
          ? "to active"
          : "to deleted"
      }.`,

      profitcenter: {
        ...updatedProfitcenter,

        status_name:
          updatedProfitcenter.status
            ? updatedProfitcenter.status
                .status_name
            : null,
      },
    };
  }
}