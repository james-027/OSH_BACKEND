import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Supplier } from "src/entities/Supplier";
import { Status } from "src/entities/Status";

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

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  // Get all suppliers
  async findAll(): Promise<any[]> {
    try {
      const suppliers =
        await this.supplierRepository.find({
          relations: ["status"],
        });

      return suppliers.map((supplier) => ({
        id: supplier.id,
        supplier_code: supplier.supplier_code,
        supplier_name: supplier.supplier_name,
        old_code: supplier.old_code,
        status_id: supplier.status_id,
        status_name: supplier.status
          ? supplier.status.status_name
          : null,
        created_at: supplier.created_at,
        updated_at: supplier.updated_at,
        created_by: supplier.created_by,
      }));
    } catch (error) {
      logger.error(
        "Error fetching suppliers:",
        error,
      );

      throw new Error(
        "Failed to fetch suppliers",
      );
    }
  }

  // Get single supplier
  async findOne(id: number): Promise<any> {
    try {
      const supplier =
        await this.supplierRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${id} not found`,
        );
      }

      return {
        id: supplier.id,
        supplier_code: supplier.supplier_code,
        supplier_name: supplier.supplier_name,
        old_code: supplier.old_code,
        status_id: supplier.status_id,
        status_name: supplier.status
          ? supplier.status.status_name
          : null,
        created_at: supplier.created_at,
        updated_at: supplier.updated_at,
        created_by: supplier.created_by,
      };
    } catch (error) {
      logger.error(
        "Error fetching supplier:",
        error,
      );

      throw error;
    }
  }

  // Create supplier
  async create(
    createSupplierDto: CreateSupplierDto,
    userId: number,
  ): Promise<any> {
    const { status_id } = createSupplierDto;

    try {
      const existingSupplier =
        await this.supplierRepository.findOne({
          where: {
            supplier_code:
              createSupplierDto.supplier_code,
          },
        });

      if (existingSupplier) {
        throw new BadRequestException(
          "Supplier code already exists",
        );
      }

      const resolvedStatusId =
        status_id || 1;

      const statusEntity =
        await this.statusRepository.findOneBy({
          id: resolvedStatusId,
        });

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

      const newSupplier =
        this.supplierRepository.create({
          supplier_code:
            createSupplierDto.supplier_code,

          supplier_name:
            createSupplierDto.supplier_name ||
            null,

          old_code:
            createSupplierDto.old_code ||
            null,

          status_id: resolvedStatusId,
          status: statusEntity,

          created_by: userId,
        });

      const savedSupplier =
        await this.supplierRepository.save(
          newSupplier,
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "SUPPLIERS",
          method: "CREATE",
          raw_data: JSON.stringify(savedSupplier),
          description: `Created supplier: ${savedSupplier.supplier_code}`,
          status_id: 1,
        },
        userId,
      );

      this.sseEventEmitter.emitCreateSignal(
        "suppliers",
        savedSupplier.id,
      );

      return {
        id: savedSupplier.id,
        supplier_code:
          savedSupplier.supplier_code,
        supplier_name:
          savedSupplier.supplier_name,
        old_code: savedSupplier.old_code,
        status_id: savedSupplier.status_id,
        status_name: savedSupplier.status
          ? savedSupplier.status.status_name
          : null,
        created_at: savedSupplier.created_at,
        updated_at: savedSupplier.updated_at,
        created_by: savedSupplier.created_by,
      };
    } catch (error) {
      logger.error(
        "Error creating supplier:",
        error,
      );

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
        updateSupplierDto.supplier_code &&
        updateSupplierDto.supplier_code !==
          supplier.supplier_code
      ) {
        const existing =
          await this.supplierRepository.findOne({
            where: {
              supplier_code:
                updateSupplierDto.supplier_code,
            },
          });

        if (existing) {
          throw new BadRequestException(
            "Supplier code already exists",
          );
        }
      }

      Object.assign(supplier, {
        supplier_code:
          updateSupplierDto.supplier_code ||
          supplier.supplier_code,

        supplier_name:
          updateSupplierDto.supplier_name ||
          supplier.supplier_name,

        old_code:
          updateSupplierDto.old_code ||
          supplier.old_code,
      });

      await this.supplierRepository.save(
        supplier,
      );

      const updatedSupplier =
        await this.supplierRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      await this.userAuditTrailCreateService.create(
        {
          service: "SUPPLIERS",
          method: "EDIT",
          raw_data: JSON.stringify(
            updatedSupplier,
          ),
          description: `Updated supplier: ${updatedSupplier.supplier_code}`,
          status_id:
            updatedSupplier.status_id || 1,
        },
        userId,
      );

      this.sseEventEmitter.emitUpdateSignal(
        "suppliers",
        updatedSupplier.id,
      );

      return {
        ...updatedSupplier,
        status_name:
          updatedSupplier.status
            ? updatedSupplier.status
                .status_name
            : null,
      };
    } catch (error) {
      logger.error(
        "Error updating supplier:",
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
    const supplier =
      await this.supplierRepository.findOne({
        where: { id },
      });

    if (!supplier) {
      throw new NotFoundException(
        "Supplier not found.",
      );
    }

    const newStatusId =
      supplier.status_id === 1
        ? 14
        : 1;

    const newStatusEntity =
      await this.statusRepository.findOneBy({
        id: newStatusId,
      });

    if (!newStatusEntity) {
      throw new Error(
        "Target status not found.",
      );
    }

    supplier.status = newStatusEntity;

    supplier.status_id =
      newStatusEntity.id;

    const updatedSupplier =
      await this.supplierRepository.save(
        supplier,
      );

    await this.userAuditTrailCreateService.create(
      {
        service: "SUPPLIERS",
        method: "TOGGLE_STATUS",
        raw_data: JSON.stringify(
          updatedSupplier,
        ),
        description: `Toggled supplier: ${updatedSupplier.supplier_code}`,
        status_id:
          updatedSupplier.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdateSignal(
      "suppliers",
      updatedSupplier.id,
    );

    return {
      message: `Supplier ${updatedSupplier.supplier_code} successfully toggled ${
        newStatusId === 1
          ? "to active"
          : "to deleted"
      }.`,
      supplier: {
        ...updatedSupplier,
        status_name:
          updatedSupplier.status
            ? updatedSupplier.status
                .status_name
            : null,
      },
    };
  }
}