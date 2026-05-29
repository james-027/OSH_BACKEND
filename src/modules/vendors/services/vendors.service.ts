import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { Vendor } from "src/entities/Vendor";
import { CreateVendorDto } from "src/modules/vendors/dto/CreateVendorDto";
import { UpdateVendorDto } from "src/modules/vendors/dto/UpdateVendorDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
      }
      const vendors = await this.vendorsRepository.find({
        where,
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "category",
          "accessKey",
        ],
      });

      return this.responseMapperService.mapEntitiesToResponse(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      throw new Error("Failed to fetch vendors");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const vendor = await this.vendorsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "category",
          "accessKey",
        ],
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(vendor);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching vendors:", error);
      throw new Error("Failed to fetch vendors");
    }
  }

  async create(
    createVendorDto: CreateVendorDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      // Check if vendor with this code already exists
      const existingVendor = await this.vendorsRepository.findOne({
        where: { service_provider_code: createVendorDto.service_provider_code },
      });

      if (existingVendor) {
        throw new BadRequestException("Vendor with this code already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newVendor = this.vendorsRepository.create({
        service_provider_name:
          createVendorDto.service_provider_name.toUpperCase(),
        service_provider_code:
          createVendorDto.service_provider_code.toUpperCase(),
        category_id: createVendorDto.category_id,
        access_key_id: accessKeyId,
        tax: createVendorDto.tax || null,
        vat: createVendorDto.vat || null,
        asf: createVendorDto.asf || null,
        erp_id: createVendorDto.erp_id || null,
        status_id: createVendorDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedVendor = await this.vendorsRepository.save(newVendor);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "VendorsService",
          method: "create",
          raw_data: JSON.stringify(savedVendor),
          description: `Created vendor ${savedVendor.id} - ${savedVendor.service_provider_name}`,
          status_id: 1,
        },
        userId,
      );

      const vendorWithRelations = await this.vendorsRepository.findOne({
        where: { id: savedVendor.id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!vendorWithRelations) {
        throw new Error("Failed to retrieve created vendor");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(vendorWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("vendors", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create vendor");
    }
  }

  async update(
    id: number,
    updateVendorDto: UpdateVendorDto,
    userId: number,
  ): Promise<any> {
    try {
      const vendor = await this.vendorsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      // Check for unique constraints if updating code
      if (updateVendorDto.service_provider_code) {
        const existingVendor = await this.vendorsRepository.findOne({
          where: {
            service_provider_code: updateVendorDto.service_provider_code,
          },
        });

        if (existingVendor && existingVendor.id !== id) {
          throw new BadRequestException("Vendor with this code already exists");
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateVendorDto.service_provider_name) {
        updateVendorDto.service_provider_name =
          updateVendorDto.service_provider_name.toUpperCase();
      }

      if (updateVendorDto.service_provider_code) {
        updateVendorDto.service_provider_code =
          updateVendorDto.service_provider_code.toUpperCase();
      }

      Object.assign(vendor, updateVendorDto, {
        updated_by: userId,
      });

      await this.vendorsRepository.save(vendor);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "VendorsService",
          method: "update",
          raw_data: JSON.stringify(vendor),
          description: `Updated vendor ${vendor.id} - ${vendor.service_provider_name}`,
          status_id: 1,
        },
        userId,
      );

      const vendorWithRelations = await this.vendorsRepository.findOne({
        where: { id: vendor.id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!vendorWithRelations) {
        throw new Error("Failed to retrieve updated vendor");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(vendorWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("vendors", response.id, response);
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
      throw new Error("Failed to update vendor");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const vendor = await this.vendorsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      const newStatusId = vendor.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.vendorsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedVendor = await this.vendorsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!updatedVendor) {
        throw new Error("Failed to retrieve updated vendor");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "VendorsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedVendor),
          description: `Toggled status for vendor ${id} - ${vendor.service_provider_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedVendor);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("vendors", response.id, response);
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
      throw new Error("Failed to toggle status for vendor");
    }
  }
}
