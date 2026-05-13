import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Profitcenter } from "src/entities/Profitcenter";
import { CreateProfitcenterDto } from "../dto/CreateProfitcenterDto";
import { UpdateProfitcenterDto } from "../dto/UpdateProfitcenterDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";

import logger from "../../../config/logger";

@Injectable()
export class ProfitcenterService {
  constructor(
    @InjectRepository(Profitcenter)
    private profitcenterRepository: Repository<Profitcenter>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
  ) {}

  // Get all profit centers
  async findAll(): Promise<any[]> {
    try {
     const profitcenters =
          await this.profitcenterRepository.find({
            where: {
              status_id: 1,
            },
          });

     return profitcenters;
    } catch (error) {
      logger.error("Error fetching profit centers:", error);
      throw new Error("Failed to fetch profit centers");
    }
  }

  // Get single profit center by ID
  async findOne(id: number): Promise<any> {
    try {
    const profitcenter = await this.profitcenterRepository.findOne({
  where: { id },
});
      if (!profitcenter) {
        throw new NotFoundException(
          `Profitcenter with ID ${id} not found`,
        );
      }

     return profitcenter;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      logger.error("Error fetching profit center:", error);
      throw new Error("Failed to fetch profit center");
    }
  }

  // Create new profit center
  async create(
    createProfitcenterDto: CreateProfitcenterDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if profit center already exists
      const existingProfitcenter =
      await this.profitcenterRepository.findOne({
        where: {
          profitcenter_code:
            createProfitcenterDto.profitcenter_code.toUpperCase(),
        },
      });

      if (existingProfitcenter) {
        throw new BadRequestException(
         "Profit center code already exists"
        );
      }

      // Create profit center
        const newProfitcenter = this.profitcenterRepository.create({
        profitcenter_code:
          createProfitcenterDto.profitcenter_code.toUpperCase(),

        profitcenter_name:
          createProfitcenterDto.profitcenter_name?.toUpperCase() || null,

          old_code:
          createProfitcenterDto.old_code?.toUpperCase() || null,

        created_by_id: userId,
      });

      const savedProfitcenter =
        await this.profitcenterRepository.save(newProfitcenter);

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "PROFITCENTER",
      //   action_name: "ADD",
      //   description: `Created profit center: ${createProfitcenterDto.profitcenter_name}`,
      //   method: "create",
      // });

  return savedProfitcenter;
    } catch (error) {
      logger.error("Error creating profit center:", error);
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
    const profitcenter = await this.profitcenterRepository.findOne({
      where: { id },
    });

    if (!profitcenter) {
      throw new NotFoundException(
        `Profitcenter with ID ${id} not found`,
      );
    }

    // Check duplicate profitcenter_code
      if (
        updateProfitcenterDto.profitcenter_code &&
        updateProfitcenterDto.profitcenter_code.toUpperCase() !==
          profitcenter.profitcenter_code
      ) {
        const existingProfitcenter =
          await this.profitcenterRepository.findOne({
            where: {
              profitcenter_code:
                updateProfitcenterDto.profitcenter_code.toUpperCase(),
            },
          });

        if (existingProfitcenter) {
          throw new BadRequestException(
            "Profit center code already exists",
          );
        }
      }

    // Update fields
    profitcenter.profitcenter_code =
      updateProfitcenterDto.profitcenter_code?.toUpperCase() ||
      profitcenter.profitcenter_code;

    profitcenter.profitcenter_name =
      updateProfitcenterDto.profitcenter_name?.toUpperCase() ||
      profitcenter.profitcenter_name;

    profitcenter.old_code =
      updateProfitcenterDto.old_code?.toUpperCase() ||
      profitcenter.old_code;

    const updatedProfitcenter =
      await this.profitcenterRepository.save(profitcenter);

    // Log audit trail
    // await this.userAuditTrailCreateService.createAuditTrail({
    //   user_id: userId,
    //   module_name: "PROFITCENTER",
    //   action_name: "EDIT",
    //   description: `Updated profit center: ${profitcenter.profitcenter_name}`,
    //   method: "update",
    // });

  return updatedProfitcenter;
  } catch (error) {
    logger.error("Error updating profit center:", error);
    throw error;
  }
}

  // Delete profit center (soft delete via status)
async delete(
  id: number,
  userId: number,
): Promise<void> {
  try {
    const profitcenter =
      await this.profitcenterRepository.findOne({
        where: { id },
      });

    if (!profitcenter) {
      throw new NotFoundException(
        `Profitcenter with ID ${id} not found`,
      );
    }

    await this.profitcenterRepository.delete(id);

  } catch (error) {
    logger.error(
      "Error deleting profit center:",
      error,
    );

    throw error;
  }
}
}