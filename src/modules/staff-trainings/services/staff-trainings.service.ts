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
import { StaffHistory } from "src/entities/StaffHistory";
import { Status } from "src/entities/Status";
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
    @InjectRepository(StaffHistory)
    private readonly staffHistoriesRepository: Repository<StaffHistory>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
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

  async findOne(id: number): Promise<any> {
    try {
      const staffTrainings = await this.staffTrainingsRepository.find({
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

      const mappedTrainings =
        this.responseMapperService.mapEntitiesToResponse(staffTrainings);

      const trainingsWithPassStatus = staffTrainings.map((t) => {
        const passingRate = Number(t.training?.passing_rate ?? 0);
        const rating = Number(t.ratings ?? 0);

        return {
          ...t,
          isPassed:
            t.status_id === 1 && passingRate > 0 && rating >= passingRate,
        };
      });

      const staffTrainingMap = new Map(
        trainingsWithPassStatus.map((t) => [Number(t.training_id), t]),
      );

      const completedOrders = new Set(
        staffTrainings
          .filter((x) => x.status_id === 1)
          .map((x) => Number(x.training?.training_order ?? 0)),
      );

      const allTrainings = await this.trainingsRepository.find({
        where: { status_id: 1 },
        order: { training_order: "ASC" },
      });

      const canPost = allTrainings.every((training) => {
        const staffTraining = staffTrainingMap.get(Number(training.id));

        if (!staffTraining) return false;

        return staffTraining.isPassed;
      });

      const nextTraining = allTrainings.find((t) => {
        const order = Number(t.training_order);
        return order > 0 && !completedOrders.has(order);
      });

      const highestOrder =
        completedOrders.size > 0 ? Math.max(...Array.from(completedOrders)) : 0;

      return {
        trainings: mappedTrainings,
        trainingSummary: {
          currentTrainingOrder: highestOrder,
          canAddTraining: !!nextTraining,
          canPost,
          nextTrainingId: nextTraining?.id ?? null,
          nextTrainingOrder: nextTraining?.training_order ?? null,
          message: nextTraining
            ? null
            : "Staff already completed all trainings.",
        },
      };
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

      const staff = await this.staffRepository.findOne({
        where: { id: createStaffTrainingDto.staff_id },
        relations: ["vendor", "location"],
      });



      if (!staff) {
        throw new BadRequestException("Staff not found");
      }

      let staffCodeGenerated = false;

      for (const item of createStaffTrainingDto.trainings) {
        let staffTraining;

        const training = await this.trainingsRepository.findOne({
          where: { id: item.training_id },
        });

        if (item.staff_training_id) {
          staffTraining = await this.staffTrainingsRepository.findOne({
            where: { id: item.staff_training_id },
          });

          if (staffTraining) {
            Object.assign(staffTraining, {
              training_id: item.training_id,
              employee_id: item.employee_id,
              sub_status_id: item.sub_status_id,
              warehouse_id: item.warehouse_id || null,
              training_start_date: item.training_start_date,
              training_end_date: item.training_end_date,
              ratings: item.ratings,
              remarks: item.remarks,
              status_id: item.status_id ?? 1,
              updated_by: userId,
            });
          }
        }

        if (!staffTraining) {
          staffTraining = this.staffTrainingsRepository.create({
            staff_id: createStaffTrainingDto.staff_id,
            training_id: item.training_id,
            employee_id: item.employee_id,
            sub_status_id: item.sub_status_id,
            warehouse_id: item.warehouse_id || null,
            training_start_date: item.training_start_date,
            training_end_date: item.training_end_date,
            ratings: item.ratings,
            remarks: item.remarks,
            status_id: item.status_id ?? 1,
            created_by: userId,
            updated_by: userId,
          });
        }

        const saved = await this.staffTrainingsRepository.save(staffTraining);
        savedTrainings.push(saved);

        const trainingStatus = await this.statusRepository.findOne({
          where: { id: saved.sub_status_id },
        });


        try {
          await this.actionLogsService.logAction({
            module_id: MODULE_IDS.STAFFS,
            ref_id: staff.id,
            action_id: item.staff_training_id
              ? ACTION_IDS.EDIT
              : ACTION_IDS.ADD,
            description: item.staff_training_id
              ? `Updated training ${training?.training_name} to ${trainingStatus?.status_name ?? "Unknown Status"} for ${staff.first_name} ${staff.last_name}`
              : `Created training ${training?.training_name} with status ${trainingStatus?.status_name ?? "Unknown Status"} for ${staff.first_name} ${staff.last_name}`,
            raw_data: JSON.stringify(saved),
            created_by: userId,
          });
        } catch (err) {
          logger.error("Action log failed for staff training:", err);
        }


        try {
          this.sseEventEmitter.emitCreate("staff_trainings", saved.id, saved);
          this.sseEventEmitter.emitCreate("staffs", saved.id, saved);
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }


        if (!createStaffTrainingDto.isDraft) { 
          const trainings = createStaffTrainingDto.trainings ?? [];

          const allPassed = trainings.every((t) => t.sub_status_id === 19);

          const failedTraining = trainings.find(
            (t) => t.sub_status_id !== 19,
          );

          await this.staffRepository.update(staff.id, {
            status_id: allPassed ? 1 : failedTraining?.sub_status_id,
            updated_by: userId,
          });

          if (allPassed && !staff.staff_code && !staffCodeGenerated) {
            const serviceProviderCode =
              staff.vendor?.service_provider_code ?? "";

            const locationCode =
              staff.location?.location_code ?? "";

            const prefix = `${serviceProviderCode}${locationCode}`;

            const trans_number =
              await this.commonUtilitiesService.generateTransactionNumber({
                transaction_type: `STAFF CODE ${locationCode}`,
                vendor_id: staff.vendor_id,
                location_id: staff.location_id,
                access_key_id: accessKeyId,
                format: "D{abbr}{key}{year}-{seq:6}",
                reset_per_year: true,
                currentDate: new Date(),
                abbr: staff.vendor?.service_provider_code ?? "",
              });

            const series = trans_number.match(/\d+$/)?.[0];

            const generatedStaffCode = `${prefix}-${series}`;

            await this.staffRepository.update(staff.id, {
              staff_code: generatedStaffCode,
              updated_by: userId,
            });

            try {
              await this.actionLogsService.logAction({
                module_id: MODULE_IDS.STAFFS,
                ref_id: staff.id,
                action_id: ACTION_IDS.EDIT,
                description: `Generated staff code '${generatedStaffCode}' for ${staff.first_name} ${staff.last_name}`,
                raw_data: JSON.stringify({
                  staff_id: staff.id,
                  old_staff_code: staff.staff_code,
                  new_staff_code: generatedStaffCode,
                }),
                created_by: userId,
              });
            } catch (err) {
              logger.error("Action log failed for staff code generation:", err);
            }

            staffCodeGenerated = true;
          }
        }


      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "upsert-create",
          raw_data: JSON.stringify(savedTrainings),
          description: `Upserted ${savedTrainings.length} staff trainings`,
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
        throw new Error("Failed to retrieve staff training");
      }

      return this.responseMapperService.mapEntityToResponse(
        staffTrainingWithRelations,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error("Failed to upsert staff training");
    }
  }

  async update(
    id: number,
    updateStaffTrainingDto: UpdateStaffTrainingDto,
    userId: number,
  ): Promise<any> {
    try {
      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const updatedTrainings = [];

      const staff = await this.staffRepository.findOne({
        where: { id: updateStaffTrainingDto.staff_id },
        relations: ["vendor", "location"],
      });

      for (const item of updateStaffTrainingDto.trainings) {
        let staffTraining;

        // UPDATE EXISTING
        if (item.staff_training_id) {
          staffTraining = await this.staffTrainingsRepository.findOne({
            where: { id: item.staff_training_id },
          });

          if (!staffTraining) {
            continue;
          }

          Object.assign(staffTraining, {
            training_id: item.training_id,
            employee_id: item.employee_id,
            sub_status_id: item.sub_status_id,
            warehouse_id: item.warehouse_id || null,
            training_start_date: item.training_start_date,
            training_end_date: item.training_end_date,
            ratings: item.ratings,
            remarks: item.remarks,
            updated_by: userId,
          });
        }

        const saved = await this.staffTrainingsRepository.save(staffTraining);

        updatedTrainings.push(saved);

        // History
        if (saved.warehouse_id != null && staff) {
          await this.staffHistoriesRepository.save({
            staff_id: staff.id,
            staff_code: staff.staff_code,
            last_name: staff.last_name,
            first_name: staff.first_name,
            middle_name: staff.middle_name,
            location_id: staff.location_id,
            vendor_id: staff.vendor_id,
            assign_status_id: staff.assign_status_id,
            position_id: staff.position_id,
            access_key_id: staff.access_key_id,
            sss_number: staff.sss_number,
            pagibig_number: staff.pagibig_number,
            tin: staff.tin,
            remarks: staff.remarks,
            overall_remarks: staff.overall_remarks,
            store_request: staff.store_request,
            hired_date: staff.hired_date,
            to_hr_date: staff.to_hr_date,
            to_sts_date: staff.to_sts_date,
            approved_eprf_date: staff.approved_eprf_date,
            req_completion_date: staff.req_completion_date,
            actual_deployment_date: staff.actual_deployment_date,
            separated_date: staff.separated_date,
            birthday: staff.birthday,
            contact_number: staff.contact_number,
            status_id: staff.status_id,
            warehouse_id: saved.warehouse_id,
            created_by: userId,
            updated_by: userId,
          });
        }

        try {
          this.sseEventEmitter.emitUpdate("staff_trainings", saved.id, saved);

          this.sseEventEmitter.emitUpdate("staffs", saved.staff_id, saved);
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "update",
          raw_data: JSON.stringify(updatedTrainings),
          description: `Updated ${updatedTrainings.length} staff trainings`,
          status_id: 1,
        },
        userId,
      );

      const response = updatedTrainings[0];

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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new Error("Failed to update staff trainings");
    }
  }

  async staffPost(
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
          statusId = 1; // Active
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

          const locationCode = staff.location?.location_code ?? "";

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
              transaction_type: `STAFF CODE ${locationCode}`,
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
          raw_data: JSON.stringify(staffTraining),
          description: `Toggled status for staff training ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(staffTraining);

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
