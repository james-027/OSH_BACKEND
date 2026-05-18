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
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "../../../config/logger";

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) { }

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
      const existingSupplier =
        await this.supplierRepository.findOne({
          where: {
            suppliercode:
              createSupplierDto.suppliercode,
          },
        });

      if (existingSupplier) {
        throw new BadRequestException(
          "Supplier code already exists",
        );
      }

      const newSupplier = this.supplierRepository.create({
        suppliercode:
          createSupplierDto.suppliercode,

        suppliername:
          createSupplierDto.suppliername || null,

        oldcode:
          createSupplierDto.oldcode || null,

        created_by: userId,
      });

      const savedSupplier =
        await this.supplierRepository.save(newSupplier);

      // Audit trail
      // Audit trail
      try {
        await this.userAuditTrailCreateService.create(
          {
            service: "SUPPLIERS",
            method: "CREATE",
            raw_data: JSON.stringify(savedSupplier),
            description: `Created supplier: ${savedSupplier.suppliercode}`,
            status_id: 1,
          },
          userId,
        );

        console.log("AUDIT SUCCESS");

      } catch (auditError) {
        console.log("AUDIT ERROR", auditError);
      }
      //  SSE CREATE
      try {
        this.sseEventEmitter.emitCreate(
          "suppliers",
          savedSupplier.id,
        );
      } catch (err) {
        logger.error("SSE create event failed:", err);
      }

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

      if (
        updateSupplierDto.suppliercode &&
        updateSupplierDto.suppliercode !==
        supplier.suppliercode
      ) {
        const existingSupplier =
          await this.supplierRepository.findOne({
            where: {
              suppliercode:
                updateSupplierDto.suppliercode,
            },
          });

        if (existingSupplier) {
          throw new BadRequestException(
            "Supplier code already exists",
          );
        }
      }

      supplier.suppliercode =
        updateSupplierDto.suppliercode ||
        supplier.suppliercode;

      supplier.suppliername =
        updateSupplierDto.suppliername ||
        supplier.suppliername;

      supplier.oldcode =
        updateSupplierDto.oldcode ||
        supplier.oldcode;

      const updatedSupplier =
        await this.supplierRepository.save(supplier);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SUPPLIERS",
          method: "EDIT",
          raw_data: JSON.stringify(updatedSupplier),
          description: `Updated supplier: ${updatedSupplier.suppliercode}`,
          status_id: updatedSupplier.status_id || 1,
        },
        userId,
      );

      //  SSE UPDATE
      try {
        this.sseEventEmitter.emitUpdate(
          "suppliers",
          updatedSupplier.id,
        );
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

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

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SUPPLIERS",
          method: "DELETE",
          raw_data: JSON.stringify(supplier),
          description: `Deleted supplier: ${supplier.suppliercode}`,
          status_id: 14,
        },
        userId,
      );

      //  SSE DELETE
      try {
        this.sseEventEmitter.emitDelete(
          "suppliers",
          id,
        );
      } catch (err) {
        logger.error("SSE delete event failed:", err);
      }

    } catch (error) {
      logger.error(
        "Error deleting supplier:",
        error,
      );

      throw error;
    }
  }
}