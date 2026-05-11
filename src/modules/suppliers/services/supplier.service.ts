import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Supplier } from "src/entities/Supplier";
import { CreateSupplierDto } from "../dto/CreateSupplierDto";
import { UpdateSupplierDto } from "../dto/UpdateSupplierDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";

import logger from "../../../config/logger";

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
  ) {}

  // Get all suppliers
  async findAll(): Promise<any[]> {
    try {
      const suppliers = await this.supplierRepository.find({
        where: {
          status_id: 1,
        },
      });

      return suppliers;
    } catch (error) {
      logger.error("Error fetching suppliers:", error);
      throw new Error("Failed to fetch suppliers");
    }
  }

  // Get single supplier by ID
  async findOne(id: number): Promise<any> {
    try {
      const supplier = await this.supplierRepository.findOne({
        where: { id },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${id} not found`,
        );
      }

      return supplier;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      logger.error("Error fetching supplier:", error);
      throw new Error("Failed to fetch supplier");
    }
  }

  // Create new supplier
  async create(
    createSupplierDto: CreateSupplierDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if supplier already exists
      const existingSupplier =
        await this.supplierRepository.findOne({
          where: {
            suppliercode:
              createSupplierDto.suppliercode.toUpperCase(),
          },
        });

      if (existingSupplier) {
        throw new BadRequestException(
          "Supplier code already exists",
        );
      }

      // Create supplier
      const newSupplier = this.supplierRepository.create({
        suppliercode:
          createSupplierDto.suppliercode.toUpperCase(),

        suppliername:
          createSupplierDto.suppliername?.toUpperCase() || null,

        oldcode:
          createSupplierDto.oldcode?.toUpperCase() || null,

        created_by_id: userId,
      });

      const savedSupplier =
        await this.supplierRepository.save(newSupplier);

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "SUPPLIER",
      //   action_name: "ADD",
      //   description: `Created supplier: ${createSupplierDto.suppliername}`,
      //   method: "create",
      // });

      return savedSupplier;
    } catch (error) {
      logger.error("Error creating supplier:", error);
      throw error;
    }
  }

  // Update supplier
  async update(
    id: number,
    updateSupplierDto: UpdateSupplierDto,
    userId: number,
  ): Promise<any> {
    try {
      const supplier =
        await this.supplierRepository.findOne({
          where: { id },
        });

      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${id} not found`,
        );
      }

      // Check duplicate suppliercode
      if (
        updateSupplierDto.suppliercode &&
        updateSupplierDto.suppliercode.toUpperCase() !==
          supplier.suppliercode
      ) {
        const existingSupplier =
          await this.supplierRepository.findOne({
            where: {
              suppliercode:
                updateSupplierDto.suppliercode.toUpperCase(),
            },
          });

        if (existingSupplier) {
          throw new BadRequestException(
            "Supplier code already exists",
          );
        }
      }

      // Update fields
      supplier.suppliercode =
        updateSupplierDto.suppliercode?.toUpperCase() ||
        supplier.suppliercode;

      supplier.suppliername =
        updateSupplierDto.suppliername?.toUpperCase() ||
        supplier.suppliername;

      supplier.oldcode =
        updateSupplierDto.oldcode?.toUpperCase() ||
        supplier.oldcode;

      const updatedSupplier =
        await this.supplierRepository.save(supplier);

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "SUPPLIER",
      //   action_name: "EDIT",
      //   description: `Updated supplier: ${supplier.suppliername}`,
      //   method: "update",
      // });

      return updatedSupplier;
    } catch (error) {
      logger.error("Error updating supplier:", error);
      throw error;
    }
  }

  // Delete supplier
  async delete(
    id: number,
    userId: number,
  ): Promise<void> {
    try {
      const supplier =
        await this.supplierRepository.findOne({
          where: { id },
        });

      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${id} not found`,
        );
      }

      await this.supplierRepository.delete(id);

    } catch (error) {
      logger.error(
        "Error deleting supplier:",
        error,
      );

      throw error;
    }
  }
}