import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Employee } from "../entities/Employee";
import { CreateEmployeeDto } from "../dto/CreateEmployeeDto";
import { UpdateEmployeeDto } from "../dto/UpdateEmployeeDto";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import { EmployeeLocationsService } from "./employee-locations.service";
import { LocationsService } from "./locations.service";
import { PositionsService } from "./positions.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";
import { CommonUtilitiesService } from "./common-utilities.service";

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private employeeLocationsService: EmployeeLocationsService,
    private locationsService: LocationsService,
    private positionsService: PositionsService,
    private commonUtilitiesService: CommonUtilitiesService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number
  ): Promise<any[]> {
    let allowedLocationIds: number[] | undefined = undefined;
    if (userId && roleId) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );
    }
    const employees = await this.employeesRepository.find({
      where: accessKeyId !== undefined ? { access_key_id: accessKeyId } : {},
      relations: [
        "employee_locations",
        "employee_locations.location",
        "position",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    // Filter employees by allowed locations
    const filtered = allowedLocationIds
      ? employees.filter((employee) =>
          (employee.employee_locations || []).some(
            (el) =>
              el.status_id === 1 && allowedLocationIds!.includes(el.location_id)
          )
        )
      : employees;
    return filtered.map((employee) => ({
      id: employee.id,
      employee_number: employee.employee_number,
      employee_first_name: employee.employee_first_name,
      employee_last_name: employee.employee_last_name,
      employee_full_name: `${employee.employee_first_name} ${employee.employee_last_name}`,
      employee_email: employee.employee_email,
      locations: (employee.employee_locations || [])
        .filter((el) => el.status_id === 1)
        .map((el) => ({
          location_id: el.location_id,
          location_name: el.location ? el.location.location_name : null,
        })),
      position_id: employee.position_id,
      position_name: employee.position ? employee.position.position_name : null,
      position_abbr: employee.position ? employee.position.position_abbr : null,
      status_id: employee.status_id,
      status_name: employee.status ? employee.status.status_name : null,
      created_at: employee.created_at,
      created_by: employee.created_by,
      updated_by: employee.updated_by,
      modified_at: employee.modified_at,
      created_user: employee.createdBy
        ? `${employee.createdBy.first_name} ${employee.createdBy.last_name}`
        : null,
      updated_user: employee.updatedBy
        ? `${employee.updatedBy.first_name} ${employee.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const employee = await this.employeesRepository.findOne({
      where: { id },
      relations: [
        "employee_locations",
        "employee_locations.location",
        "position",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return {
      id: employee.id,
      employee_number: employee.employee_number,
      employee_first_name: employee.employee_first_name,
      employee_last_name: employee.employee_last_name,
      employee_email: employee.employee_email,
      locations: (employee.employee_locations || [])
        .filter((el) => el.status_id === 1)
        .map((el) => ({
          location_id: el.location_id,
          location_name: el.location ? el.location.location_name : null,
        })),
      position_id: employee.position_id,
      position_name: employee.position ? employee.position.position_name : null,
      status_id: employee.status_id,
      status_name: employee.status ? employee.status.status_name : null,
      created_at: employee.created_at,
      created_by: employee.created_by,
      updated_by: employee.updated_by,
      modified_at: employee.modified_at,
      created_user: employee.createdBy
        ? `${employee.createdBy.first_name} ${employee.createdBy.last_name}`
        : null,
      updated_user: employee.updatedBy
        ? `${employee.updatedBy.first_name} ${employee.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createEmployeeDto: CreateEmployeeDto,
    userId: number,
    roleId?: number
  ): Promise<Employee> {
    const { location_ids, ...employeeData } = createEmployeeDto;
    // Validate allowed locations
    if (roleId && Array.isArray(location_ids)) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );
      for (const locId of location_ids) {
        if (!allowedLocationIds.includes(locId)) {
          throw new BadRequestException(
            `You are not allowed to assign location_id ${locId}`
          );
        }
      }
    }
    const employee = this.employeesRepository.create({
      ...employeeData,
      access_key_id: createEmployeeDto.access_key_id,
      created_by: userId,
      updated_by: userId,
    });
    try {
      const saved = await this.employeesRepository.save(employee);
      // Handle employee_locations
      if (Array.isArray(location_ids)) {
        for (const location_id of location_ids) {
          await this.employeeLocationsService.addLocation({
            employee_id: saved.id,
            location_id,
            status_id: 1,
            created_by: userId,
            updated_by: userId,
          });
        }
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "EmployeesService",
          method: "create",
          raw_data: JSON.stringify(saved),
          description: `Created employee ${saved.id} - ${saved.employee_number} | ${saved.employee_last_name}`,
          status_id: 1,
        },
        userId
      );
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("employees", saved.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
      return saved;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    userId: number,
    roleId?: number
  ): Promise<Employee> {
    const { location_ids, ...employeeData } = updateEmployeeDto;
    // Validate allowed locations
    if (roleId && Array.isArray(location_ids)) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );
      for (const locId of location_ids) {
        if (!allowedLocationIds.includes(locId)) {
          throw new BadRequestException(
            `You are not allowed to assign location_id ${locId}`
          );
        }
      }
    }
    const employee = await this.findOne(id);
    Object.assign(employee, employeeData, { updated_by: userId });
    try {
      const saved = await this.employeesRepository.save(employee);
      // Handle employee_locations
      if (Array.isArray(location_ids)) {
        // Set all to inactive
        const existing = await this.employeeLocationsService.findByEmployee(id);
        for (const el of existing) {
          if (el.status_id !== 2) {
            await this.employeeLocationsService.toggleStatus(el.id, 2);
          }
        }
        // Reactivate or add
        for (const location_id of location_ids) {
          const found = existing.find((el) => el.location_id === location_id);
          if (found) {
            await this.employeeLocationsService.toggleStatus(found.id, 1);
          } else {
            await this.employeeLocationsService.addLocation({
              employee_id: id,
              location_id,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            });
          }
        }
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "EmployeesService",
          method: "update",
          raw_data: JSON.stringify(saved),
          description: `Updated employee ${saved.id} - ${saved.employee_number} | ${saved.employee_last_name}`,
          status_id: 1,
        },
        userId
      );
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("employees", saved.id);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
      return saved;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: number): Promise<void> {
    const employee = await this.findOne(id);
    await this.employeesRepository.remove(employee);
  }

  async toggleStatus(
    id: number,
    status_id: number,
    userId: number
  ): Promise<Employee> {
    const employee = await this.findOne(id);
    employee.status_id = status_id;
    employee.updated_by = userId;
    const saved = await this.employeesRepository.save(employee);
    // Cascade to employee_locations
    const locations = await this.employeeLocationsService.findByEmployee(id);
    for (const el of locations) {
      if (el.status_id !== status_id) {
        await this.employeeLocationsService.toggleStatus(el.id, status_id);
      }
    }
    const newStatusName = status_id === 1 ? "Active" : "Inactive";
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "EmployeesService",
        method: "toggleStatus",
        raw_data: JSON.stringify(saved),
        description: `Toggled status for employee ${saved.id} - ${saved.employee_number} | ${saved.employee_last_name} to ${newStatusName}`,
        status_id: 1,
      },
      userId
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("employees", saved.id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return saved;
  }

  async uploadExcelEmployees(
    filePath: string,
    userId: number,
    roleId?: number,
    accessKeyId?: number
  ) {
    const XLSX = require("xlsx");
    const fs = require("fs");
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: { row: number; error: string }[] = [];
    const success: any[] = [];
    let inserted_count = 0;
    let updated_count = 0;
    // Preload all locations and positions for fast lookup
    const allLocations = await this.locationsService.findAll();
    const allPositions = await this.positionsService.findAll();
    // --- Allowed location validation ---
    let allowedLocationIds: number[] | undefined = undefined;
    if (roleId) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );
    }
    // --- Preprocess for batch duplicate checks ---
    const batchEmployeeNumbers = new Set<string>();
    const batchCompositeKeys = new Set<string>();
    const batchEmails = new Set<string>();
    const batchMap: Map<string, number> = new Map(); // employee_number -> rowNum
    const toInsert: any[] = [];
    const toUpdate: {
      row: any;
      existing: any;
      rowNum: number;
      location_ids: number[];
    }[] = [];
    // Fetch all existing employees for fast lookup
    const allExisting = await this.employeesRepository.find();
    const dbEmployeeNumbers = new Set(
      allExisting.map((e) => e.employee_number)
    );
    const dbCompositeKeys = new Set(
      allExisting.map(
        (e) =>
          `${e.employee_number}|${e.employee_first_name}|${e.employee_last_name}`
      )
    );
    const dbEmails = new Set(
      allExisting.filter((e) => !!e.employee_email).map((e) => e.employee_email)
    );
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = row["__rowNum__"] || i + 2;
      try {
        // Validation: required fields
        const required = [
          "EMP. NO.",
          "FIRST NAME",
          "LAST NAME",
          "POSITION",
          "LOCATION",
          "STATUS",
        ];
        for (const field of required) {
          if (!row[field] || String(row[field]).trim() === "") {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        // Parse and lookup locations
        let location_ids: number[] = [];
        if (typeof row["LOCATION"] === "string") {
          const locationNames = row["LOCATION"]
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          for (const locName of locationNames) {
            const foundLoc = allLocations.find(
              (l: any) =>
                l.location_name.toLowerCase() === locName.toLowerCase()
            );
            if (!foundLoc) {
              throw new Error(`Location not found: ${locName}`);
            }
            location_ids.push(foundLoc.id);
          }
        } else {
          throw new Error("Invalid LOCATION column format");
        }
        // --- Allowed location validation ---
        if (allowedLocationIds && location_ids.length > 0) {
          for (const locId of location_ids) {
            if (!allowedLocationIds.includes(locId)) {
              throw new Error(
                `You are not allowed to assign location_id ${locId}`
              );
            }
          }
        }
        // Lookup position
        let position_id: number | undefined = undefined;
        if (typeof row["POSITION"] === "string") {
          const foundPos = allPositions.find(
            (p: any) =>
              p.position_name.toLowerCase() === row["POSITION"].toLowerCase()
          );
          if (!foundPos) {
            throw new Error(`Position not found: ${row["POSITION"]}`);
          }
          position_id = foundPos.id;
        } else {
          throw new Error("Invalid POSITION column format");
        }
        // Map status
        let status_id = 1;
        if (typeof row["STATUS"] === "string") {
          const statusVal = row["STATUS"].toUpperCase().trim();
          if (statusVal === "ACTIVE") status_id = 1;
          else if (statusVal === "INACTIVE") status_id = 2;
          else throw new Error(`Invalid STATUS value: ${row["STATUS"]}`);
        } else {
          throw new Error("Invalid STATUS column format");
        }
        // Duplicate checks (DB and batch)
        const employee_number = String(row["EMP. NO."]);
        const employee_first_name = String(row["FIRST NAME"]);
        const employee_last_name = String(row["LAST NAME"]);
        const employee_email = row["EMAIL"] ? String(row["EMAIL"]) : undefined;
        const compositeKey = `${employee_number}|${employee_first_name}|${employee_last_name}`;
        // Check batch duplicates
        if (batchEmployeeNumbers.has(employee_number)) {
          throw new Error(
            `Duplicate employee_number in batch: ${employee_number}`
          );
        }
        if (batchCompositeKeys.has(compositeKey)) {
          throw new Error(
            `Duplicate employee_number+first_name+last_name in batch: ${compositeKey}`
          );
        }
        if (employee_email && batchEmails.has(employee_email)) {
          throw new Error(
            `Duplicate employee_email in batch: ${employee_email}`
          );
        }
        batchEmployeeNumbers.add(employee_number);
        batchCompositeKeys.add(compositeKey);
        if (employee_email) batchEmails.add(employee_email);
        batchMap.set(employee_number, rowNum);
        // Check DB duplicates
        let existing = allExisting.find(
          (e) => e.employee_number === employee_number
        );
        if (!existing) {
          existing = allExisting.find(
            (e) =>
              e.employee_number === employee_number &&
              e.employee_first_name === employee_first_name &&
              e.employee_last_name === employee_last_name
          );
        }
        if (!existing && employee_email) {
          existing = allExisting.find(
            (e) => e.employee_email === employee_email
          );
        }
        // Prepare employee data
        const employeeData: any = {
          employee_number,
          employee_first_name,
          employee_last_name,
          employee_email,
          position_id,
          status_id,
          access_key_id: accessKeyId,
          created_by: userId,
          updated_by: userId,
        };
        if (existing) {
          toUpdate.push({ row, existing, rowNum, location_ids });
        } else {
          toInsert.push({ employeeData, row, rowNum, location_ids });
        }
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }
    // --- Bulk Insert ---
    let insertedEmployees: any[] = [];
    if (toInsert.length > 0) {
      // Ensure employeeData is always an object, not an array
      const entities = toInsert
        .map((rec) => {
          return Array.isArray(rec.employeeData)
            ? this.employeesRepository.create(rec.employeeData[0])
            : this.employeesRepository.create(rec.employeeData);
        })
        .flat();
      insertedEmployees = await this.employeesRepository.save(entities);
      for (let idx = 0; idx < insertedEmployees.length; idx++) {
        const saved = insertedEmployees[idx];
        const { row, rowNum, location_ids } = toInsert[idx];
        // Handle employee_locations
        if (Array.isArray(location_ids)) {
          for (const location_id of location_ids) {
            await this.employeeLocationsService.addLocation({
              employee_id: saved.id,
              location_id,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            });
          }
        }
        inserted_count++;
        inserted_row_numbers.push(rowNum);
        success.push({ ...row, __rowNum__: rowNum });
      }
    }
    // --- Updates ---
    for (const upd of toUpdate) {
      try {
        Object.assign(upd.existing, upd.row);
        upd.existing.employee_last_name = upd.row["LAST NAME"];
        upd.existing.employee_first_name = upd.row["FIRST NAME"];
        const saved = await this.employeesRepository.save(upd.existing);
        // Handle employee_locations
        if (Array.isArray(upd.location_ids)) {
          // Set all to inactive
          const existingLocs =
            await this.employeeLocationsService.findByEmployee(saved.id);
          for (const el of existingLocs) {
            if (el.status_id !== 2) {
              await this.employeeLocationsService.toggleStatus(el.id, 2);
            }
          }
          // Reactivate or add
          for (const location_id of upd.location_ids) {
            const found = existingLocs.find(
              (el) => el.location_id === location_id
            );
            if (found) {
              await this.employeeLocationsService.toggleStatus(found.id, 1);
            } else {
              await this.employeeLocationsService.addLocation({
                employee_id: saved.id,
                location_id,
                status_id: 1,
                created_by: userId,
                updated_by: userId,
              });
            }
          }
        }
        updated_count++;
        updated_row_numbers.push(upd.rowNum);
        success.push({ ...upd.row, __rowNum__: upd.rowNum });
      } catch (err) {
        errors.push({ row: upd.rowNum, error: err.message });
      }
    }
    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("employees", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
}
