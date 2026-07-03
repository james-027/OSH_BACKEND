import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, QueryRunner } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { Staff } from "src/entities/Staff";
import { Location } from "src/entities/Location";
import {
  CheckStaffDto,
  CreateStaffDto,
  RevertStaffDto,
} from "src/modules/staffs/dto/CreateStaffDto";
import { UpdateStaffDto } from "src/modules/staffs/dto/UpdateStaffDto";
import { UpdateStaffTransferDto } from "src/modules/staffs/dto/UpdateStaffTransferDto";
import { UpdateStaffDeployDto } from "src/modules/staffs/dto/UpdateStaffDeployDto";
import { parseExcelDate } from "src/utils/date.utils";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { Position } from "src/entities/Position";
import { Vendor } from "src/entities/Vendor";
import { Status } from "src/entities/Status";
import { StaffBrand } from "src/entities/StaffBrand";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { StaffCategoryType } from "src/entities/StaffCategoryType";
import { StaffSalary } from "src/entities/StaffSalary";
import { StaffHistory } from "src/entities/StaffHistory";
import { Brand } from "src/entities/Brand";
import { CategoryType } from "src/entities/CategoryType";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import {
  MODULE_IDS,
  ACTION_IDS,
  STATUS_IDS,
  NAMING_CONVENTION,
} from "src/constants/customConstants";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { StaffTraining } from "src/entities/StaffTrainings";
import { Training } from "src/entities/Training";
import { StaffTransfers } from "src/entities/StaffTransfers";
@Injectable()
export class StaffsService {
  constructor(
    @InjectRepository(Staff)
    private staffsRepository: Repository<Staff>,
    @InjectRepository(StaffBrand)
    private staffBrandsRepository: Repository<StaffBrand>,
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalaryRepository: Repository<StaffVendorSalary>,
    @InjectRepository(StaffSalary)
    private staffSalaryRepository: Repository<StaffSalary>,
    @InjectRepository(StaffCategoryType)
    private staffCategoryTypesRepository: Repository<StaffCategoryType>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(Brand)
    private brandRepository: Repository<Brand>,
    @InjectRepository(CategoryType)
    private categoryTypeRepository: Repository<CategoryType>,
    @InjectRepository(StaffHistory)
    private readonly staffHistoriesRepository: Repository<StaffHistory>,
    @InjectRepository(StaffTransfers)
    private readonly staffTransfersRepository: Repository<StaffTransfers>,
    @InjectRepository(StaffWarehouse)
    private readonly staffWarehouseRepository: Repository<StaffWarehouse>,
    @InjectRepository(StaffTraining)
    private readonly staffTrainingsRepository: Repository<StaffTraining>,
    @InjectRepository(Training)
    private readonly trainingsRepository: Repository<Training>,
    private actionLogsService: ActionLogsService,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  async findAll(accessKeyId?: number, statusId?: number[], assignStatusId?: number[]): Promise<any[]> {
    try {
      const where: any = {};

      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
      }
      if (assignStatusId && assignStatusId.length > 0) {
        where.assign_status_id = In(assignStatusId);
      } else if (statusId && statusId.length > 0) {
        where.status_id = In(statusId);
         where.assign_status_id = 13;
      }
      const staffs = await this.staffsRepository.find({
        where,
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "accessKey",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
          "staffSalaries",
           "staffTransfers",
        ],
        order: {
          modified_at: "DESC",
        },
      });

      const allTrainings = await this.trainingsRepository.find({
        where: { status_id: 1 },
        order: { training_order: "ASC" },
      });

      const staffTrainings = await this.staffTrainingsRepository.find({
        relations: ["training"],
      });

      const trainingMap = new Map<number, any[]>();

      for (const t of staffTrainings) {
        const key = t.staff_id;
        if (!trainingMap.has(key)) trainingMap.set(key, []);
        trainingMap.get(key)!.push(t);
      }

      const result = staffs.map((staff) => {
        const trainings = trainingMap.get(staff.id) || [];

        const totalActiveTrainings = allTrainings.length;

        const hasTraining = trainings.length > 0;

        const passedTrainings = trainings.filter((t) => {
          const trainingMeta = allTrainings.find(
            (at) => Number(at.id) === Number(t.training_id),
          );

          const passingRate = Number(trainingMeta?.passing_rate ?? 0);

          return t.ratings !== "" && Number(t.ratings) >= passingRate;
        });

        const failedTrainings = trainings.filter((t) => {
          const trainingMeta = allTrainings.find(
            (at) => Number(at.id) === Number(t.training_id),
          );

          const passingRate = Number(trainingMeta?.passing_rate ?? 0);

          return t.ratings !== "" && Number(t.ratings) < passingRate;
        });

        const isSingleTraining = totalActiveTrainings === 1;

        const allPassed =
          hasTraining &&
          passedTrainings.length === totalActiveTrainings &&
          totalActiveTrainings > 0;

        let canPost = false;

        if (!hasTraining) {
          canPost = false;
        } else if (isSingleTraining) {
          canPost = failedTrainings.length > 0;
        } else if (allPassed) {
          canPost = true;
        } else {
          canPost = failedTrainings.length > 0;
        }

        return {
          ...this.responseMapperService.mapEntityToResponse(staff),
          canPost,
        };
      });

      return result;
    } catch (error) {
      console.error("Error fetching staffs:", error);
      throw new Error("Failed to fetch staffs");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
          "staffSalaries",
          "staffTransfers",
          "staffTransfers.vendor",
          "staffTransfers.location",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(staff);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staffs:", error);
      throw new Error("Failed to fetch staffs");
    }
  }

  async create(
    createStaffDto: CreateStaffDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const firstName = createStaffDto.first_name.toUpperCase().trim();
      const lastName = createStaffDto.last_name.trim();
      const middleName = (createStaffDto.middle_name || "")
        .toUpperCase()
        .trim();

      const whereCondition: any = {
        first_name: firstName,
        last_name: lastName,
      };

      if (middleName) {
        whereCondition.middle_name = middleName;
      }

      const existingRecord = await this.staffsRepository.findOne({
        where: whereCondition,
      });

      if (existingRecord) {
        throw new BadRequestException(
          `Staff '${createStaffDto.first_name} ${createStaffDto.last_name}' may already exist`,
        );
      }

      const newStaff = this.staffsRepository.create({
        staff_code: createStaffDto.staff_code
          ? createStaffDto.staff_code.toUpperCase()
          : null,
        last_name: createStaffDto.last_name.toUpperCase(),
        first_name: createStaffDto.first_name.toUpperCase(),
        middle_name: createStaffDto.middle_name
          ? createStaffDto.middle_name.toUpperCase()
          : null,
        location_id: createStaffDto.location_id,
        email: createStaffDto.email,
        vendor_id: createStaffDto.vendor_id,
        assign_status_id: 13,
        position_id: createStaffDto.position_id,
        access_key_id: accessKeyId,
        sss_number: createStaffDto.sss_number || null,
        pagibig_number: createStaffDto.pagibig_number || null,
        tin: createStaffDto.tin || null,
        remarks: createStaffDto.remarks || null,
        hired_date: createStaffDto.hired_date
          ? new Date(createStaffDto.hired_date)
          : null,
        to_hr_date: createStaffDto.to_hr_date
          ? new Date(createStaffDto.to_hr_date)
          : null,
        to_sts_date: createStaffDto.to_sts_date
          ? new Date(createStaffDto.to_sts_date)
          : null,
        approved_eprf_date: createStaffDto.approved_eprf_date
          ? new Date(createStaffDto.approved_eprf_date)
          : null,
        req_completion_date: createStaffDto.req_completion_date
          ? new Date(createStaffDto.req_completion_date)
          : null,
        actual_deployment_date: createStaffDto.actual_deployment_date
          ? new Date(createStaffDto.actual_deployment_date)
          : null,
        separated_date: createStaffDto.separated_date
          ? new Date(createStaffDto.separated_date)
          : null,
        birthday: createStaffDto.birthday
          ? new Date(createStaffDto.birthday)
          : null,
        contact_number: createStaffDto.contact_number || null,
        overall_remarks: createStaffDto.overall_remarks || null,
        store_request: createStaffDto.store_request || null,
        status_id: 20,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaff = await this.staffsRepository.save(newStaff);
      await this.staffHistoriesRepository.save({
        staff_id: savedStaff.id,
        staff_code: savedStaff.staff_code,
        last_name: savedStaff.last_name,
        first_name: savedStaff.first_name,
        email: savedStaff.email,
        middle_name: savedStaff.middle_name,
        location_id: savedStaff.location_id,
        vendor_id: savedStaff.vendor_id,
        assign_status_id: savedStaff.assign_status_id,
        position_id: savedStaff.position_id,
        access_key_id: savedStaff.access_key_id,
        sss_number: savedStaff.sss_number,
        pagibig_number: savedStaff.pagibig_number,
        tin: savedStaff.tin,
        remarks: savedStaff.remarks,
        overall_remarks: savedStaff.overall_remarks,
        store_request: savedStaff.store_request,
        hired_date: savedStaff.hired_date,
        to_hr_date: savedStaff.to_hr_date,
        to_sts_date: savedStaff.to_sts_date,
        approved_eprf_date: savedStaff.approved_eprf_date,
        req_completion_date: savedStaff.req_completion_date,
        actual_deployment_date: savedStaff.actual_deployment_date,
        separated_date: savedStaff.separated_date,
        birthday: savedStaff.birthday,
        contact_number: savedStaff.contact_number,
        status_id: savedStaff.status_id,
        created_by: userId,
        updated_by: userId,
      });

      const newStaffBrand = this.staffBrandsRepository.create({
        staff_id: savedStaff.id,
        brand_id: createStaffDto.brand_id,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const newStaffCategoryType = this.staffCategoryTypesRepository.create({
        staff_id: savedStaff.id,
        category_type_id: createStaffDto.category_type_id,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const newStaffVendorSalary = this.staffVendorSalaryRepository.create({
        staff_id: savedStaff.id,
        vendor_id: createStaffDto.vendor_id,
        location_id: createStaffDto.location_id,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaffBrand =
        await this.staffBrandsRepository.save(newStaffBrand);
      const savedStaffCategoryType =
        await this.staffCategoryTypesRepository.save(newStaffCategoryType);
      const savedStaffVendorSalary =
        await this.staffVendorSalaryRepository.save(newStaffVendorSalary);

      const newStaffSalary = this.staffSalaryRepository.create({
        staff_id: savedStaff.id,
        staff_vendor_id: newStaffVendorSalary.id,
        allowance: createStaffDto.allowance,
        salary_rate: createStaffDto.salary_rate,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaffSalary =
        await this.staffSalaryRepository.save(newStaffSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaff),
          description: `Created staff ${savedStaff.id} - ${savedStaff.first_name} ${savedStaff.last_name}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffBrand),
          description: `Created staff Brand ${savedStaffBrand.id}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffCategoryType),
          description: `Created staff category ${savedStaffCategoryType.id}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffVendorSalary),
          description: `Created staff vendor${savedStaffVendorSalary.id} `,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffSalary),
          description: `Created staff salary${savedStaffSalary.id} `,
          status_id: 1,
        },
        userId,
      );

      const staffWithRelations = await this.staffsRepository.findOne({
        where: { id: savedStaff.id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
      });

      if (!staffWithRelations) {
        throw new Error("Failed to retrieve created staff");
      }

      // Action Log
      try {
        await this.actionLogsService.logAction({
          module_id: MODULE_IDS.STAFFS, // use your actual module ID
          ref_id: savedStaff.id,
          action_id: ACTION_IDS.ADD,
          description: `Created staff ${savedStaff.staff_code ?? ""} - ${savedStaff.first_name} ${savedStaff.last_name} | Vendor: ${staffWithRelations.vendor?.service_provider_name ?? "N/A"} | Location: ${staffWithRelations.location?.location_name ?? "N/A"}`,
          raw_data: JSON.stringify(createStaffDto),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for create:", err);
        // Don't throw - action log failure shouldn't block creation
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("staffs", response.id, response);
        this.sseEventEmitter.emitCreate(
          "staff_vendor_salaries",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create staff");
    }
  }

  async update(
    id: number,
    updateStaffDto: UpdateStaffDto,
    userId: number,
  ): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const firstName = updateStaffDto.first_name.toUpperCase().trim();
      const lastName = updateStaffDto.last_name.trim();
      const middleName = (updateStaffDto.middle_name || "")
        .toUpperCase()
        .trim();

      const whereCondition: any = {
        first_name: firstName,
        last_name: lastName,
      };

      if (middleName) {
        whereCondition.middle_name = middleName;
      }

      const existingRecord = await this.staffsRepository.findOne({
        where: whereCondition,
      });

      if (existingRecord && existingRecord.id !== id) {
        throw new BadRequestException(
          `Staff '${updateStaffDto.first_name} ${updateStaffDto.middle_name} ${updateStaffDto.last_name}' may already exist`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const safeDate = (value: any) => {
        if (!value || value === "") return null;

        const date = new Date(value);

        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date: ${value}`);
        }

        return date;
      };

      const updateData: any = { ...updateStaffDto };
      delete updateData.status_id;

      updateData.hired_date = safeDate(updateData.hired_date);
      updateData.to_hr_date = safeDate(updateData.to_hr_date);
      updateData.to_sts_date = safeDate(updateData.to_sts_date);
      updateData.approved_eprf_date = safeDate(updateData.approved_eprf_date);
      updateData.req_completion_date = safeDate(updateData.req_completion_date);
      updateData.actual_deployment_date = safeDate(
        updateData.actual_deployment_date,
      );
      updateData.separated_date = safeDate(updateData.separated_date);
      updateData.birthday = safeDate(updateData.birthday);

      if (updateData.last_name) {
        updateData.last_name = updateData.last_name.toUpperCase();
      }

      if (updateData.first_name) {
        updateData.first_name = updateData.first_name.toUpperCase();
      }

      if (updateData.middle_name) {
        updateData.middle_name = updateData.middle_name.toUpperCase();
      }

      if (updateData.staff_code) {
        updateData.staff_code = updateData.staff_code.toUpperCase();
      }

      Object.assign(staff, updateData, {
        updated_by: userId,
      });

      const savedStaff = await this.staffsRepository.save(staff);

      await this.staffHistoriesRepository.save({
        staff_id: staff.id,
        staff_code: staff.staff_code,
        last_name: staff.last_name,
        first_name: staff.first_name,
        email: staff.email,
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
        created_by: userId,
        updated_by: userId,
      });

      let staffBrand = await this.staffBrandsRepository.findOne({
        where: { staff_id: staff.id },
        order: { id: "DESC" },
      });

      if (!staffBrand || staffBrand.brand_id !== updateStaffDto.brand_id) {
        const newRecord = this.staffBrandsRepository.create({
          staff_id: staff.id,
          brand_id: updateStaffDto.brand_id,
          access_key_id: staff.access_key_id,
          status_id: updateStaffDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        });

        await this.staffBrandsRepository.save(newRecord);
      }

      let staffCategoryType = await this.staffCategoryTypesRepository.findOne({
        where: { staff_id: staff.id },
        order: { id: "DESC" },
      });

      if (
        !staffCategoryType ||
        staffCategoryType.category_type_id !== updateStaffDto.category_type_id
      ) {
        const newRecord = this.staffCategoryTypesRepository.create({
          staff_id: staff.id,
          category_type_id: updateStaffDto.category_type_id,
          access_key_id: staff.access_key_id,
          status_id: 1,
          created_by: userId,
          updated_by: userId,
        });

        await this.staffCategoryTypesRepository.save(newRecord);
      }

      const queryRunner =
        this.staffsRepository.manager.connection.createQueryRunner();

      await this.syncVendorAndSalary(
        queryRunner,
        staff,
        {
          vendor_id: updateStaffDto.vendor_id,
          location_id: updateStaffDto.location_id,
          salary_rate: updateStaffDto.salary_rate,
          allowance: updateStaffDto.allowance,
          status_id: updateStaffDto.status_id,
        },
        userId,
      );

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "update",
          raw_data: JSON.stringify(staff),
          description: `Updated staff ${staff.id} - ${staff.first_name} ${staff.last_name}`,
          status_id: 1,
        },
        userId,
      );

      const staffWithRelations = await this.staffsRepository.findOne({
        where: { id: staff.id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
      });

      if (!staffWithRelations) {
        throw new Error("Failed to retrieve updated staff");
      }

      try {
        await this.actionLogsService.logAction({
          module_id: MODULE_IDS.STAFFS, // use your actual module ID
          ref_id: savedStaff.id,
          action_id: ACTION_IDS.EDIT,
          description: `Created staff ${savedStaff.staff_code ?? ""} - ${savedStaff.first_name} ${savedStaff.last_name} | Vendor: ${staffWithRelations.vendor?.service_provider_name ?? "N/A"} | Location: ${staffWithRelations.location?.location_name ?? "N/A"}`,
          raw_data: JSON.stringify(updateStaffDto),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for create:", err);
        // Don't throw - action log failure shouldn't block creation
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWithRelations);

      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
        this.sseEventEmitter.emitUpdate("staff_brands", response.id, response);
        this.sseEventEmitter.emitUpdate(
          "staff_trainings",
          response.id,
          response,
        );
        this.sseEventEmitter.emitUpdate(
          "staff_category_types",
          response.id,
          response,
        );
        this.sseEventEmitter.emitUpdate(
          "staff_vendor_salaries",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      console.error("UPDATE STAFF ERROR:", error);
      throw error;
    }
  }

  async staffTransfer(
    id: number,
    updateStaffTransferDto: UpdateStaffTransferDto,
    userId: number,
  ): Promise<any> {
    try {
      const safeDate = (value: any) => {
        if (!value || value === "") return null;

        const date = new Date(value);

        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date: ${value}`);
        }

        return date;
      };

      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const newVendorId = updateStaffTransferDto.vendor_id;
      const newLocationId = updateStaffTransferDto.location_id;
      const newSalaryRate = updateStaffTransferDto.salary_rate;
      const newAllowance = updateStaffTransferDto.allowance;
      const transferRemarks = updateStaffTransferDto.remarks;

      const isVendorChanged = staff.vendor_id !== newVendorId;
      const isLocationChanged = staff.location_id !== newLocationId;

      if (!isVendorChanged && !isLocationChanged) {
        return this.responseMapperService.mapEntityToResponse(staff);
      }

      const effectivityDate = safeDate(
        updateStaffTransferDto.effectivity_date,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (effectivityDate) {
        const selectedDate = new Date(effectivityDate);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
          throw new BadRequestException(
            "Effectivity date cannot be earlier than today.",
          );
        }
      }

      await this.staffTransfersRepository.save({
        staff_id: staff.id,
        old_vendor_id: staff.vendor_id,
        new_vendor_id: newVendorId,
        old_location_id: staff.location_id,
        new_location_id: newLocationId,
        salary_rate: newSalaryRate,
        allowance: newAllowance,
        remarks: transferRemarks,
        effectivity_date: safeDate(updateStaffTransferDto.effectivity_date),
        access_key_id: staff.access_key_id,
        status: false,
        created_by: userId,
        updated_by: userId,
      });

      return {
        message: "Transfer scheduled successfully.",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to process staff transfer");
    }
  }

  private isTransferRunning = false;

  async processScheduledTransfers(): Promise<void> {
    if (this.isTransferRunning) {
      return;
    }

    this.isTransferRunning = true;

    try {

      const pendingTransfers = await this.staffTransfersRepository.find({
        where: {
          status: false,
        },
      });

      logger.info(`Pending transfers found: ${pendingTransfers.length}`);

      for (const transfer of pendingTransfers) {

        const queryRunner =
          this.staffsRepository.manager.connection.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {

          const effectivityDate = new Date(transfer.effectivity_date)
            .toISOString()
            .split("T")[0];

          const today = new Date()
            .toISOString()
            .split("T")[0];

          if (effectivityDate > today) {
            logger.warn(
              `Transfer ${transfer.id} skipped. Effectivity date is in the future.`,
            );

            await queryRunner.rollbackTransaction();
            continue;
          }

          const staff = await this.staffsRepository.findOne({
            where: {
              id: transfer.staff_id,
            },
            relations: ["location", "vendor"],
          });
          const vendor = await this.vendorRepository.findOne({
            where: {
              id: transfer.new_vendor_id,
            },
          });
          const location = await this.locationRepository.findOne({
            where: {
              id: transfer.new_location_id,
            },
          });

          if (!staff) {
            await queryRunner.rollbackTransaction();
            continue;
          }

          const oldLocation = staff.location?.location_name ?? "N/A";
          const oldVendor = staff.vendor?.service_provider_name ?? "N/A";

          const newLocation = location.location_name ?? "N/A";
          const newVendor = vendor.service_provider_name ?? "N/A";

          await queryRunner.manager.update(Staff, transfer.staff_id, {
            location_id: transfer.new_location_id,
            vendor_id: transfer.new_vendor_id,
            updated_by: transfer.created_by,
            effectivity_date: transfer.effectivity_date,
          });

          await this.syncVendorAndSalary(
            queryRunner,
            staff,
            {
              vendor_id: transfer.new_vendor_id,
              location_id: transfer.new_location_id,
              salary_rate: transfer.salary_rate,
              allowance: transfer.allowance,
              status_id: 1,
            },
            transfer.created_by,
          );
          const isVendorChanged = staff.vendor_id !== transfer.new_vendor_id;

          const isLocationChanged =
            staff.location_id !== transfer.new_location_id;

          const updatedStaff = await this.staffsRepository.findOne({
            where: { id: staff.id },
            relations: [
              "status",
              "assignmentStatus",
              "createdBy",
              "updatedBy",
              "location",
              "vendor",
              "position",
            ],
          });

          if (!updatedStaff) {
            throw new Error(`Failed to retrieve updated staff ${staff.id}`);
          }

          let generatedStaffCode: string | null = null;

          if (isVendorChanged || isLocationChanged) {
            const serviceProviderCode = vendor.service_provider_code ?? "";

            const locationCode = location.location_code ?? "";

            const prefix = `${serviceProviderCode}${locationCode}`;

            const trans_number =
              await this.commonUtilitiesService.generateTransactionNumber({
                transaction_type: `STAFF CODE ${locationCode}`,
                vendor_id: transfer.new_vendor_id,
                location_id: transfer.new_location_id,
                access_key_id: transfer.access_key_id,
                format: "D{abbr}{key}{year}-{seq:6}",
                reset_per_year: false,
                currentDate: new Date(),
                abbr: vendor.service_provider_code ?? "",
              });

            const series = trans_number.match(/\d+$/)?.[0];

            generatedStaffCode = `${prefix}-${series}`;

            await queryRunner.manager.update(Staff, updatedStaff.id, {
              staff_code: generatedStaffCode,
            });

            updatedStaff.staff_code = generatedStaffCode;
          }

          await queryRunner.manager.save(StaffHistory, {
            staff_id: updatedStaff.id,
            staff_code: updatedStaff.staff_code,
            last_name: updatedStaff.last_name,
            first_name: updatedStaff.first_name,
            email: updatedStaff.email,
            middle_name: updatedStaff.middle_name,
            location_id: transfer.new_location_id,
            vendor_id: transfer.new_vendor_id,
            assign_status_id: updatedStaff.assign_status_id,
            position_id: updatedStaff.position_id,
            access_key_id: updatedStaff.access_key_id,
            sss_number: updatedStaff.sss_number,
            pagibig_number: updatedStaff.pagibig_number,
            tin: updatedStaff.tin,
            remarks: transfer.remarks,
            overall_remarks: updatedStaff.overall_remarks,
            store_request: updatedStaff.store_request,
            hired_date: updatedStaff.hired_date,
            to_hr_date: updatedStaff.to_hr_date,
            to_sts_date: updatedStaff.to_sts_date,
            approved_eprf_date: updatedStaff.approved_eprf_date,
            req_completion_date: updatedStaff.req_completion_date,
            actual_deployment_date: updatedStaff.actual_deployment_date,
            separated_date: updatedStaff.separated_date,
            birthday: updatedStaff.birthday,
            contact_number: updatedStaff.contact_number,
            status_id: updatedStaff.status_id,
            effectivity_date: updatedStaff.effectivity_date,
            created_by: transfer.created_by,
            updated_by: transfer.created_by,
          });

          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "staffTransfer",
              raw_data: JSON.stringify(updatedStaff),
              description: `Staff transfer executed for ${transfer.staff_id} - ${staff.first_name} ${staff.last_name} from Vendor: ${oldVendor} / Location: ${oldLocation}`,
              status_id: 1,
            },
            transfer.created_by,
          );

          transfer.status = true;

          await queryRunner.manager.save(StaffTransfers, transfer);

          await queryRunner.commitTransaction();

          try {
            await this.actionLogsService.logAction({
              module_id: MODULE_IDS.STAFFS,
              ref_id: updatedStaff.id,
              action_id: ACTION_IDS.TRANSFER,
              description: `Staff transferred ${updatedStaff.first_name} ${updatedStaff.last_name} | Vendor: ${oldVendor} → ${
                newVendor
              } | Location: ${oldLocation} → ${newLocation}`,
              raw_data: JSON.stringify({
                id: updatedStaff.id,
                old_vendor: staff.vendor_id,
                new_vendor: updatedStaff.vendor_id,
                old_location: staff.location_id,
                new_location: updatedStaff.location_id,
                new_staff_code: generatedStaffCode,
                transfer_id: transfer.id,
                scheduled_transfer: true,
              }),
              created_by: transfer.created_by,
            });
          } catch (err) {
            logger.error("Action log failed for scheduled transfer:", err);
          }

          const response =
            this.responseMapperService.mapEntityToResponse(updatedStaff);

          try {
            this.sseEventEmitter.emitUpdate("staffs", response.id, response);

            this.sseEventEmitter.emitUpdate(
              "staff_vendor_salaries",
              response.id,
              response,
            );

            this.sseEventEmitter.emitUpdate(
              "staff_transfers",
              response.id,
              response,
            );

            logger.info(`SSE events emitted.`);
          } catch (err) {
            logger.error("SSE event failed for scheduled transfer:");
            logger.error(err);
          }

        } catch (err: any) {
          await queryRunner.rollbackTransaction();

          logger.error(
            `Scheduled transfer failed. Transfer ID: ${transfer.id}`,
          );

          logger.error(`Error Message: ${err?.message}`);

          logger.error(`Error Stack: ${err?.stack}`);
        } finally {
          await queryRunner.release();

          logger.info(`QueryRunner released for transfer ${transfer.id}`);
        }
      }
    } catch (err: any) {
      logger.error(`processScheduledTransfers failed: ${err?.message}`);
      logger.error(err?.stack);
    } finally {
      this.isTransferRunning = false;
    }
  }

  private async syncVendorAndSalary(
    queryRunner: QueryRunner,
    staff: any,
    dto: {
      vendor_id: number;
      location_id: number;
      salary_rate?: number;
      allowance?: number;
      status_id?: number;
    },
    userId: number,
  ) {
    try {
      logger.info(`[syncVendorAndSalary] START - Staff ID: ${staff.id}`);

      const staffVendorSalary = await queryRunner.manager.findOne(
        StaffVendorSalary,
        {
          where: {
            staff_id: staff.id,
          },
          order: {
            id: "DESC",
          },
        },
      );

      const staffSalary = await queryRunner.manager.findOne(StaffSalary, {
        where: {
          staff_id: staff.id,
        },
        order: {
          id: "DESC",
        },
      });

      const isChanged =
        !staffVendorSalary ||
        staffVendorSalary.vendor_id !== dto.vendor_id ||
        staffVendorSalary.location_id !== dto.location_id ||
        Number(staffSalary?.salary_rate ?? 0) !==
          Number(dto.salary_rate ?? 0) ||
        Number(staffSalary?.allowance ?? 0) !== Number(dto.allowance ?? 0);

      logger.info(`[syncVendorAndSalary] isChanged: ${isChanged}`);

      if (!isChanged) {
        logger.info(`[syncVendorAndSalary] No changes detected.`);

        return {
          staffVendorSalary,
          staffSalary,
          changed: false,
        };
      }

      logger.info(`[syncVendorAndSalary] Creating StaffVendorSalary`);

      const newStaffVendorSalary = await queryRunner.manager.save(
        StaffVendorSalary,
        queryRunner.manager.create(StaffVendorSalary, {
          staff_id: staff.id,
          vendor_id: dto.vendor_id,
          location_id: dto.location_id,
          access_key_id: staff.access_key_id,
          status_id: dto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        }),
      );

      logger.info(
        `[syncVendorAndSalary] StaffVendorSalary created. ID: ${newStaffVendorSalary.id}`,
      );

      logger.info(`[syncVendorAndSalary] Creating StaffSalary`);

      const newStaffSalary = await queryRunner.manager.save(
        StaffSalary,
        queryRunner.manager.create(StaffSalary, {
          staff_id: staff.id,
          staff_vendor_id: newStaffVendorSalary.id,
          salary_rate: dto.salary_rate ?? 0,
          allowance: dto.allowance ?? 0,
          access_key_id: staff.access_key_id,
          status_id: dto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        }),
      );

      logger.info(
        `[syncVendorAndSalary] StaffSalary created. ID: ${newStaffSalary.id}`,
      );

      logger.info(`[syncVendorAndSalary] END SUCCESS`);

      return {
        staffVendorSalary: newStaffVendorSalary,
        staffSalary: newStaffSalary,
        changed: true,
      };
    } catch (err: any) {
      logger.error(`[syncVendorAndSalary] ERROR`);

      logger.error(`[syncVendorAndSalary] Message: ${err?.message}`);

      logger.error(`[syncVendorAndSalary] Stack: ${err?.stack}`);

      throw err;
    }
  }

  async revertStaff(
    id: number,
    revertStaffDto: RevertStaffDto,
    userId: number,
  ): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const newStatusId = 20;
      const newStatusName = "Revert";

      await this.staffsRepository.update(id, {
        status_id: newStatusId,
        remarks: revertStaffDto.remarks,
      });

      const updatedStaff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!updatedStaff) {
        throw new Error("Failed to retrieve updated staff");
      }

      const staffHistory = this.staffHistoriesRepository.save({
        staff_id: updatedStaff.id,

        staff_code: updatedStaff.staff_code,
        last_name: updatedStaff.last_name,
        first_name: updatedStaff.first_name,
        middle_name: updatedStaff.middle_name,
        email: updatedStaff.email,

        location_id: updatedStaff.location_id,
        vendor_id: updatedStaff.vendor_id,
        assign_status_id: updatedStaff.assign_status_id,
        position_id: updatedStaff.position_id,

        access_key_id: updatedStaff.access_key_id,

        sss_number: updatedStaff.sss_number,
        pagibig_number: updatedStaff.pagibig_number,
        tin: updatedStaff.tin,

        remarks: updatedStaff.remarks,
        overall_remarks: updatedStaff.overall_remarks,
        store_request: updatedStaff.store_request,

        hired_date: updatedStaff.hired_date,
        to_hr_date: updatedStaff.to_hr_date,
        to_sts_date: updatedStaff.to_sts_date,
        approved_eprf_date: updatedStaff.approved_eprf_date,
        req_completion_date: updatedStaff.req_completion_date,
        actual_deployment_date: updatedStaff.actual_deployment_date,
        separated_date: updatedStaff.separated_date,
        birthday: updatedStaff.birthday,

        contact_number: updatedStaff.contact_number,

        status_id: updatedStaff.status_id,

        created_by: userId,
        updated_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaff),
          description: `Toggled status for staff ${id} - ${updatedStaff.first_name} ${updatedStaff.last_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      try {
        await this.actionLogsService.logAction({
          module_id: MODULE_IDS.STAFFS,
          ref_id: updatedStaff.id,
          action_id: ACTION_IDS.REVERT,
          description: `Change staff ${updatedStaff.first_name} ${updatedStaff.last_name} to ${newStatusName}. Remarks: ${updatedStaff.remarks || "No remarks provided"}`,
          raw_data: JSON.stringify({
            id: updatedStaff.id,
            old_status: staff.status_id,
            new_status: newStatusId,
          }),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for toggleStatus:", err);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(updatedStaff);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
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
      throw new Error("Failed to toggle status for staff");
    }
  }

  async staffDeploy(
    id: number,
    updateStaffDeployDto: UpdateStaffDeployDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const newWarehouseId = updateStaffDeployDto.warehouse_id;

      const staffWarehouse = await this.staffWarehouseRepository.save({
        staff_id: staff.id,
        warehouse_id: newWarehouseId,
        staff_code: staff.staff_code,
        location_id: staff.location_id,
        vendor_id: staff.vendor_id,
        effectivity_date: updateStaffDeployDto.effectivity_date,
        end_date: updateStaffDeployDto.end_date || null,
        remarks: updateStaffDeployDto.remarks,
        created_by: userId,
        updated_by: userId,
        access_key_id: accessKeyId,
      });

      const staffWarehouseDetails = await this.staffWarehouseRepository.findOne(
        {
          where: { id: staffWarehouse.id },
          relations: ["warehouse"],
        },
      );

        const isBuddyUp = updateStaffDeployDto.action === "buddyup";
        const assignStatusId = isBuddyUp ? STATUS_IDS.TEMPORARY_ASSIGNMENT : STATUS_IDS.WITH_ASSIGNMENT;
        const actionId = isBuddyUp ? ACTION_IDS.BUDDY_UP : ACTION_IDS.DEPLOY;

      if (staffWarehouse) {

 

        await this.staffsRepository.update(id, {
          assign_status_id: assignStatusId,
          warehouse_id: staffWarehouseDetails.warehouse_id,
          effectivity_date: staffWarehouseDetails.effectivity_date,
          updated_by: staffWarehouseDetails.updated_by,
        });

        const updatedStaff = await this.staffsRepository.findOne({
          where: { id },
        });

        await this.staffHistoriesRepository.save({
        staff_id: updatedStaff.id,
        staff_code: updatedStaff.staff_code,
        last_name: updatedStaff.last_name,
        first_name: updatedStaff.first_name,
        email: updatedStaff.email,
        middle_name: updatedStaff.middle_name,
        location_id: updatedStaff.location_id,
        vendor_id: updatedStaff.vendor_id,
        assign_status_id: updatedStaff.assign_status_id,
        position_id: updatedStaff.position_id,
        access_key_id: updatedStaff.access_key_id,
        sss_number: updatedStaff.sss_number,
        pagibig_number: updatedStaff.pagibig_number,
        tin: updatedStaff.tin,
        remarks: updatedStaff.remarks,
        overall_remarks: updatedStaff.overall_remarks,
        store_request: updatedStaff.store_request,
        hired_date: updatedStaff.hired_date,
        to_hr_date: updatedStaff.to_hr_date,
        to_sts_date: updatedStaff.to_sts_date,
        approved_eprf_date: updatedStaff.approved_eprf_date,
        req_completion_date: updatedStaff.req_completion_date,
        actual_deployment_date: updatedStaff.actual_deployment_date,
        separated_date: updatedStaff.separated_date,
        birthday: updatedStaff.birthday,
        contact_number: updatedStaff.contact_number,
        status_id: updatedStaff.status_id,
        warehouse_id: updatedStaff.warehouse_id,
        effectivity_date: updatedStaff.effectivity_date,
        created_by: userId,
        updated_by: userId,
      });
      }

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "staffTransfer",
          raw_data: JSON.stringify(staffWarehouse),
          description: `Staff Deploy executed for ${id} - ${staff.first_name} ${staff.last_name} to ${NAMING_CONVENTION.WAREHOUSE}: ${staffWarehouseDetails.warehouse.warehouse_name} `,
          status_id: 1,
        },
        userId,
      );

      try {
        await this.actionLogsService.logAction({
          module_id: MODULE_IDS.STAFFS,
          ref_id: staff.id,
          action_id: actionId,
          description: `Staff ${staff.first_name} ${staff.last_name} Deployed to ${NAMING_CONVENTION.WAREHOUSE}: ${staffWarehouseDetails.warehouse.warehouse_name}`,
          raw_data: JSON.stringify({
            staffWarehouse,
          }),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for staffTransfer:", err);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWarehouse);
      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
        this.sseEventEmitter.emitUpdate("staff_warehouses", response.id, response);
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
      throw new Error("Failed to process staff transfer");
    }
  }

  async uploadExcel(
    file: Express.Multer.File,
    userId: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");

    const workbook = XLSX.readFile(file.path);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: null,
    });

    const success = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Skip completely empty row
        if (!row["First Name"] && !row["Last Name"]) {
          continue;
        }

        // REQUIRED FIELD VALIDATION
        const requiredFields = [
          "First Name",
          "Last Name",
          "Email",
          "Location",
          "Position",
          "Vendor",
          "Brand",
          "Category Type",
        ];

        const missingFields = requiredFields.filter(
          (field) =>
            row[field] === null ||
            row[field] === undefined ||
            String(row[field]).trim() === "",
        );

        if (missingFields.length > 0) {
          errors.push({
            row: i + 2,
            error: `Missing required field(s): ${missingFields.join(", ")}`,
          });

          continue;
        }

        const location = await this.locationRepository.findOne({
          where: { location_name: row["Location"] },
        });

        const position = await this.positionRepository.findOne({
          where: { position_name: row["Position"] },
        });

        const vendor = await this.vendorRepository.findOne({
          where: { service_provider_name: row["Vendor"] },
        });

        const brand = await this.brandRepository.findOne({
          where: { brand_name: row["Brand"] },
        });
        const categoryType = await this.categoryTypeRepository.findOne({
          where: { category_type_name: row["Category Type"] },
        });

        if (!location) {
          errors.push({
            row: i + 2,
            error: `Location '${row["Location"]}' not found`,
          });
          continue;
        }

        if (!position) {
          errors.push({
            row: i + 2,
            error: `Position '${row["Position"]}' not found`,
          });
          continue;
        }

        if (!vendor) {
          errors.push({
            row: i + 2,
            error: `Vendor '${row["Vendor"]}' not found`,
          });
          continue;
        }

        if (!brand) {
          errors.push({
            row: i + 2,
            error: `Brand '${row["Brand"]}' not found`,
          });
          continue;
        }
        if (!categoryType) {
          errors.push({
            row: i + 2,
            error: `Category Type '${row["Category Type"]}' not found`,
          });
          continue;
        }

        const firstName = row["First Name"].toUpperCase().trim();
        const lastName = row["Last Name"].toUpperCase().trim();
        const middleName = (row["Middle Name"] || "").toUpperCase().trim();
        const staffCode = row["Staff Code"]?.toString().trim();

        let existingRecord = null;

        if (staffCode) {
          existingRecord = await this.staffsRepository.findOne({
            where: {
              staff_code: staffCode,
            },
          });

          if (!existingRecord) {
            const whereCondition: any = {
              first_name: firstName,
              last_name: lastName,
            };

            if (middleName) {
              whereCondition.middle_name = middleName;
            }

            existingRecord = await this.staffsRepository.findOne({
              where: whereCondition,
            });
          }
        } else {
          const whereCondition: any = {
            first_name: firstName,
            last_name: lastName,
          };

          if (middleName) {
            whereCondition.middle_name = middleName;
          }

          existingRecord = await this.staffsRepository.findOne({
            where: whereCondition,
          });
        }

        let savedStaff;
        let savedStaffBrand;
        let savedStaffCategoryType;
        let savedStaffVendorSalary;

        if (existingRecord) {
          existingRecord.contact_number = row["Contact Number"];
          existingRecord.staff_code = staffCode;
          existingRecord.first_name = firstName;
          existingRecord.last_name = lastName;
          existingRecord.email = row["Email"];
          existingRecord.middle_name = middleName;
          existingRecord.birthday = parseExcelDate(row["Birthday"]);
          existingRecord.location_id = location.id;
          existingRecord.vendor_id = vendor.id;
          existingRecord.position_id = position.id;
          existingRecord.access_key_id = accessKeyId;
          existingRecord.store_request = row["Store Request"];
          existingRecord.sss_number = row["SSS Number"];
          existingRecord.tin = row["TIN"];
          existingRecord.pagibig_number = row["PAGIBIG Number"];
          existingRecord.remarks = row["Remarks"];
          existingRecord.hired_date = parseExcelDate(row["Hired Date"]);
          existingRecord.to_hr_date = parseExcelDate(row["To HR Date"]);
          existingRecord.separated_date = parseExcelDate(row["Seperated Date"]);
          existingRecord.to_sts_date = parseExcelDate(row["To STS Date"]);
          existingRecord.approved_eprf_date = parseExcelDate(
            row["Approved EPRF Date"],
          );
          existingRecord.req_completion_date = parseExcelDate(
            row["Req Completion Date"],
          );
          existingRecord.actual_deployment_date = parseExcelDate(
            row["Actual Deployment Date"],
          );
          existingRecord.overall_remarks = row["Overall Remarks"];
          existingRecord.updated_by = userId;

          savedStaff = await this.staffsRepository.save(existingRecord);

          let existingStaffBrand = await this.staffBrandsRepository.findOne({
            where: {
              staff_id: savedStaff.id,
              access_key_id: accessKeyId,
            },
          });

          if (existingStaffBrand) {
            existingStaffBrand.brand_id = brand.id;
            existingStaffBrand.status_id = 1;
            existingStaffBrand.updated_by = userId;

            savedStaffBrand =
              await this.staffBrandsRepository.save(existingStaffBrand);
          } else {
            savedStaffBrand = await this.staffBrandsRepository.save(
              this.staffBrandsRepository.create({
                staff_id: savedStaff.id,
                brand_id: brand.id,
                access_key_id: accessKeyId,
                status_id: 1,
                created_by: userId,
                updated_by: userId,
              }),
            );
          }

          let existingCategoryType =
            await this.staffCategoryTypesRepository.findOne({
              where: {
                staff_id: savedStaff.id,
                access_key_id: accessKeyId,
              },
            });

          if (existingCategoryType) {
            existingCategoryType.category_type_id = categoryType.id;
            existingCategoryType.status_id = 1;
            existingCategoryType.updated_by = userId;

            savedStaffCategoryType =
              await this.staffCategoryTypesRepository.save(
                existingCategoryType,
              );
          } else {
            savedStaffCategoryType =
              await this.staffCategoryTypesRepository.save(
                this.staffCategoryTypesRepository.create({
                  staff_id: savedStaff.id,
                  category_type_id: categoryType.id,
                  access_key_id: accessKeyId,
                  status_id: 1,
                  created_by: userId,
                  updated_by: userId,
                }),
              );
          }

          let existingVendorSalary =
            await this.staffVendorSalaryRepository.findOne({
              where: {
                staff_id: savedStaff.id,
                access_key_id: accessKeyId,
              },
            });

          if (existingVendorSalary) {
            existingVendorSalary.vendor_id = vendor.id;
            existingVendorSalary.location_id = location.id;
            // existingVendorSalary.allowance = row["Allowance"] || null;
            // existingVendorSalary.salary_rate = row["Salary Rate"] || null;
            existingVendorSalary.status_id = 1;
            existingVendorSalary.updated_by = userId;

            savedStaffVendorSalary =
              await this.staffVendorSalaryRepository.save(existingVendorSalary);
          } else {
            savedStaffVendorSalary =
              await this.staffVendorSalaryRepository.save(
                this.staffVendorSalaryRepository.create({
                  staff_id: savedStaff.id,
                  vendor_id: vendor.id,
                  location_id: location.id,
                  access_key_id: accessKeyId,
                  // allowance: row["Allowance"] || null,
                  // salary_rate: row["Salary Rate"] || null,
                  status_id: 1,
                  created_by: userId,
                  updated_by: userId,
                }),
              );
          }
        } else {
          const newStaff = this.staffsRepository.create({
            first_name: firstName,
            staff_code: staffCode,
            contact_number: row["Contact Number"],
            last_name: lastName,
            middle_name: middleName,
            email: row["Email"],
            birthday: parseExcelDate(row["Birthday"]),
            location_id: location.id,
            vendor_id: vendor.id,
            position_id: position.id,
            access_key_id: accessKeyId,
            assign_status_id: 13,
            store_request: row["Store Request"],
            sss_number: row["SSS Number"],
            tin: row["TIN"],
            pagibig_number: row["PAGIBIG Number"],
            remarks: row["Remarks"],
            hired_date: parseExcelDate(row["Hired Date"]),
            to_hr_date: parseExcelDate(row["To HR Date"]),
            separated_date: parseExcelDate(row["Seperated Date"]),
            to_sts_date: parseExcelDate(row["To STS Date"]),
            approved_eprf_date: parseExcelDate(row["Approved EPRF Date"]),
            req_completion_date: parseExcelDate(row["Req Completion Date"]),
            actual_deployment_date: parseExcelDate(
              row["Actual Deployment Date"],
            ),
            overall_remarks: row["Overall Remarks"],
            status_id: 20,
            created_by: userId,
            updated_by: userId,
          });

          savedStaff = await this.staffsRepository.save(newStaff);

          if (savedStaff) {
            try {
              await this.staffHistoriesRepository.save(
                this.staffHistoriesRepository.create({
                  ...savedStaff,
                  staff_id: savedStaff.id,
                }),
              );
            } catch (err) {
              logger.error("Failed to create staff history:", err);
            }
          }

          savedStaffBrand = await this.staffBrandsRepository.save(
            this.staffBrandsRepository.create({
              staff_id: savedStaff.id,
              brand_id: brand.id,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          savedStaffCategoryType = await this.staffCategoryTypesRepository.save(
            this.staffCategoryTypesRepository.create({
              staff_id: savedStaff.id,
              category_type_id: categoryType.id,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          savedStaffVendorSalary = await this.staffVendorSalaryRepository.save(
            this.staffVendorSalaryRepository.create({
              staff_id: savedStaff.id,
              vendor_id: vendor.id,
              location_id: location.id,
              access_key_id: accessKeyId,
              // allowance: row["Allowance"] || null,
              // salary_rate: row["Salary Rate"] || null,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );
        }

        await this.userAuditTrailCreateService.create(
          {
            service: "StaffsService",
            method: "uploadExcel",
            raw_data: JSON.stringify(savedStaff),
            description: `Upload staff ${savedStaff.id} - ${savedStaff.first_name} ${savedStaff.last_name}`,
            status_id: 1,
          },
          userId,
        );

        if (savedStaffBrand) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffBrand),
              description: `Staff Brand ${savedStaffBrand.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        if (savedStaffCategoryType) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffCategoryType),
              description: `Staff Category Type ${savedStaffCategoryType.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        if (savedStaffVendorSalary) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffVendorSalary),
              description: `Staff Vendor Salary ${savedStaffVendorSalary.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        const staffWithRelations = await this.staffsRepository.findOne({
          where: { id: savedStaff.id },
          relations: [
            "status",
            "assignmentStatus",
            "createdBy",
            "updatedBy",
            "location",
            "vendor",
            "position",
            "staffBrands.brand",
            "staffCategoryTypes.categoryType",
            "staffVendorSalaries",
          ],
        });

        if (staffWithRelations) {
          try {
            const vendorName =
              staffWithRelations.vendor?.service_provider_name ?? "N/A";

            const locationName =
              staffWithRelations.location?.location_name ?? "N/A";

            await this.actionLogsService.logAction({
              module_id: MODULE_IDS.STAFFS,
              ref_id: savedStaff.id,
              action_id: existingRecord ? ACTION_IDS.EDIT : ACTION_IDS.ADD,
              description: existingRecord
                ? `Updated staff ${savedStaff.staff_code ?? ""} - ${savedStaff.first_name} ${savedStaff.last_name} | Vendor: ${vendorName} | Location: ${locationName}`
                : `Created staff ${savedStaff.staff_code ?? ""} - ${savedStaff.first_name} ${savedStaff.last_name} | Vendor: ${vendorName} | Location: ${locationName}`,
              raw_data: JSON.stringify(row),
              created_by: userId,
            });
          } catch (err) {
            logger.error("Action log failed for upload:", err);
          }
        }

        success.push({
          row: i + 2,
          action: existingRecord ? "updated" : "inserted",
          data: staffWithRelations,
        });
      } catch (error) {
        errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      inserted_count: success.filter((s) => s.action === "inserted").length,
      updated_count: success.filter((s) => s.action === "updated").length,

      inserted_row_numbers: success
        .filter((s) => s.action === "inserted")
        .map((s) => s.row),

      updated_row_numbers: success
        .filter((s) => s.action === "updated")
        .map((s) => s.row),

      success,
      errors,
    };
  }

  async checkExistingStaff(dto: CheckStaffDto) {
    const firstName = dto.first_name.toUpperCase().trim();
    const lastName = dto.last_name.trim();
    const middleName = (dto.middle_name || "").toUpperCase().trim();

    const whereCondition: any = {
      first_name: firstName,
      last_name: lastName,
    };

    if (middleName) {
      whereCondition.middle_name = middleName;
    }

    const existingRecord = await this.staffsRepository.findOne({
      where: whereCondition,
    });

    return {
      exists: !!existingRecord,
      staff: existingRecord,
    };
  }
  async findOneHistory(ref_id: number) {
    const module_id = MODULE_IDS.STAFFS;
    return this.actionLogsService.findPerModuleRefID(module_id, ref_id);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStatusId = staff.status_id === 1 ? 2 : 1;

      await this.staffsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      const updatedStaff = await this.staffsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedStaff) {
        throw new Error("Failed to retrieve updated staff");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaff),
          description: `${
            newStatusId === 1 ? "Activated" : "Deactivated"
          } staff ${updatedStaff.first_name} ${updatedStaff.last_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedStaff);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
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

    throw new Error("Failed to process staff transfer");
    }
  }
}
