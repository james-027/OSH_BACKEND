import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { StaffTraining } from "src/entities/StaffTrainings";
import { CreateStaffTrainingDto } from "src/modules/staff-trainings/dto/CreateStaffTrainingDto";
import { UpdateStaffTrainingDto } from "src/modules/staff-trainings/dto/UpdateStaffTrainingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { Staff } from "src/entities/Staff";
import { Training } from "src/entities/Training";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import {
  MODULE_IDS,
  ACTION_IDS,
  STATUS_IDS,
  STATUS_NAMES,
} from "src/constants/customConstants";
@Injectable()
export class StaffTrainingService {
  constructor(
    @InjectRepository(StaffTraining)
    private staffTrainingsRepository: Repository<StaffTraining>,
    @InjectRepository(Training)
    private trainingsRepository: Repository<Training>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private responseMapperService: ResponseMapperService,
    private actionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const staffTrainings = await this.staffTrainingsRepository.find({
        relations: ["status", "createdBy", "updatedBy", "staff", "warehouse"],
      });

      return this.responseMapperService.mapEntitiesToResponse(staffTrainings);
    } catch (error) {
      console.error("Error fetching staff trainings:", error);
      throw new Error("Failed to fetch staff trainings");
    }
  }

  async findOne(id: number): Promise<any[]> {
    try {
      const staffTraining = await this.staffTrainingsRepository.find({
        where: { staff_id: id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "staff",
          "warehouse",
          "training",
          "employee",
          "subStatus",
        ],
      });

      return this.responseMapperService.mapEntitiesToResponse(staffTraining);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staff trainings:", error);
      throw new Error("Failed to fetch staff trainings");
    }
  }

  async create(
    createStaffTrainingDto: CreateStaffTrainingDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const savedTrainings = [];

      let staffCodeGenerated = false;
      let statusId: number;
      let trans_number = "";

      const staff = await this.staffRepository.findOne({
        where: { id: createStaffTrainingDto.staff_id },
        relations: ["vendor", "location"],
      });

      for (const item of createStaffTrainingDto.trainings) {
        const newStaffTraining = this.staffTrainingsRepository.create({
          staff_id: createStaffTrainingDto.staff_id,
          training_id: item.training_id,
          employee_id: item.employee_id,
          sub_status_id: item.sub_status_id,
          warehouse_id: item.warehouse_id || null,
          training_start_date: item.training_start_date,
          training_end_date: item.training_end_date,
          ratings: item.ratings,
          remarks: item.remarks,
          status_id: createStaffTrainingDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        });

        if (item.sub_status_id === 19) {
          statusId = 1; // Active / Passed
        } else {
          statusId = item.sub_status_id;
        }

        const saved =
          await this.staffTrainingsRepository.save(newStaffTraining);
        savedTrainings.push(saved);
        await this.staffRepository.update(staff.id, {
          status_id: statusId,
        });
        const training = await this.trainingsRepository.findOne({
          where: { id: item.training_id },
        });

        if (
          training &&
          item.ratings >= training.passing_rate &&
          staff &&
          !staffCodeGenerated
        ) {
          const serviceProviderCode = staff.vendor?.service_provider_code ?? "";

          const locationCode = staff.location?.location_abbr ?? "";

          const prefix = `${serviceProviderCode}${locationCode}`;

          const latestStaff = await this.staffRepository
            .createQueryBuilder("staff")
            .where("staff.staff_code LIKE :prefix", {
              prefix: `${prefix}%`,
            })
            .orderBy("staff.staff_code", "DESC")
            .getOne();

          let nextSeries = 1;

          if (latestStaff?.staff_code) {
            const seriesPart = latestStaff.staff_code.substring(prefix.length);

            nextSeries = parseInt(seriesPart, 10) + 1;
          }

          trans_number =
            await this.commonUtilitiesService.generateTransactionNumber({
              transaction_type: "STAFF TRAINING",
              vendor_id: staff.vendor_id,
              location_id: staff.location_id,
              access_key_id: accessKeyId,
              format: "D{abbr}{key}{year}-{seq:6}",
              reset_per_year: true,
              currentDate: new Date(),
              abbr: staff.vendor?.service_provider_code ?? "",
            });

          const series = trans_number.match(/\d+$/)?.[0];

          const generatedStaffCode = prefix + "-" + series;

          await this.staffRepository.update(staff.id, {
            staff_code: generatedStaffCode,
          });

          try {
            await this.actionLogsService.logAction({
              module_id: MODULE_IDS.STAFFS,
              ref_id: staff.id,
              action_id: ACTION_IDS.EDIT,
              description: `Generated staff code '${generatedStaffCode}' for ${staff.first_name} ${staff.last_name} after passing ${training.training_name}`,
              raw_data: JSON.stringify({
                staff_id: staff.id,
                old_staff_code: staff.staff_code,
                new_staff_code: generatedStaffCode,
                training_id: training.id,
                training_name: training.training_name,
                ratings: item.ratings,
                passing_rate: training.passing_rate,
              }),
              created_by: userId,
            });
          } catch (err) {
            logger.error("Action log failed for staff code generation:", err);
          }


          staffCodeGenerated = true;
        }

        try {
          this.sseEventEmitter.emitCreate("staffs", saved.id, saved);
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "create",
          raw_data: JSON.stringify(savedTrainings),
          description: `Created ${savedTrainings.length} staff trainings`,
          status_id: 1,
        },
        userId,
      );

      const response = savedTrainings[0];

      const staffTrainingWithRelations =
        await this.staffTrainingsRepository.findOne({
          where: { id: response.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "warehouse",
            "employee",
          ],
        });

      if (!staffTrainingWithRelations) {
        throw new Error("Failed to retrieve created staff training");
      }
      

      return this.responseMapperService.mapEntityToResponse(
        staffTrainingWithRelations,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create staff training");
    }
  }

  async update(
    id: number,
    updateStaffTrainingDto: UpdateStaffTrainingDto,
    userId: number,
  ): Promise<any> {
    try {
      const staffTraining = await this.staffTrainingsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!staffTraining) {
        throw new NotFoundException(`Staff Training with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(staffTraining, updateStaffTrainingDto, {
        updated_by: userId,
      });

      await this.staffTrainingsRepository.save(staffTraining);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "update",
          raw_data: JSON.stringify(staffTraining),
          description: `Updated staff training ${staffTraining.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffTrainingWithRelations =
        await this.staffTrainingsRepository.findOne({
          where: { id: staffTraining.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
          ],
        });

      if (!staffTrainingWithRelations) {
        throw new Error("Failed to retrieve updated staff training");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffTrainingWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_trainings",
          response.id,
          response,
        );
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
      throw new Error("Failed to update staff vendor salary");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const staffTraining = await this.staffTrainingsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "staff",
          "vendor",
          "location",
        ],
      });

      if (!staffTraining) {
        throw new NotFoundException(`Staff Training with ID ${id} not found`);
      }

      const newStatusId = staffTraining.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffTrainingsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedStaffTraining = await this.staffTrainingsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "staff",
          "vendor",
          "location",
        ],
      });

      if (!updatedStaffTraining) {
        throw new Error("Failed to retrieve updated staff training");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaffTraining),
          description: `Toggled status for staff training ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedStaffTraining);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_trainings",
          response.id,
          response,
        );
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
      throw new Error("Failed to toggle status for staff training");
    }
  }
}
