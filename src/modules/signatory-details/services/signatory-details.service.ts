import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Raw } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { CreateSignatoryHeaderDto } from "src/modules/signatory-details/dto/CreateSignatoryDto";
import { UpdateSignatoryHeaderDto } from "src/modules/signatory-details/dto/UpdateSignatoryDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { SignatoryHeader } from "src/entities/SignatoryHeader";
import { SignatoryType } from "src/entities/SignatoryTypes";
import { Position } from "src/entities/Position";
import { SignatoryDetail } from "src/entities/SignatoryDetails";
import { STATUS_IDS } from "src/constants/customConstants";

@Injectable()
export class SignatoryDetailService {
  constructor(
    @InjectRepository(SignatoryDetail)
    private signatoryDetailRepository: Repository<SignatoryDetail>,
    @InjectRepository(SignatoryType)
    private signatoryTypeRepository: Repository<SignatoryType>,
    @InjectRepository(SignatoryHeader)
    private signatoryHeaderRepository: Repository<SignatoryHeader>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  // async findAll(accessKeyId: number): Promise<any[]> {
  //   try {
  //     const signatoryDetails = await this.signatoryDetailRepository.find({
  //       where: {
  //         signatoryHeader: {
  //           access_key_id: accessKeyId,
  //         },
  //       },
  //       relations: [
  //         "status",
  //         "createdBy",
  //         "updatedBy",
  //         "signatoryHeader.module",
  //         "signatoryType",
  //         "signatoree",
  //         "position",
  //       ],
  //     });
  //     return this.responseMapperService.mapEntitiesToResponse(signatoryDetails);
  //   } catch (error) {
  //     console.error("Error fetching signatory details:", error);
  //     throw new Error("Failed to fetch signatory details");
  //   }
  // }

async findAll(accessKeyId: number): Promise<any[]> {
  try {
    const signatoryHeaders = await this.signatoryHeaderRepository.find({
      where: {
        access_key_id: accessKeyId,
      },
      relations: [
        "status",
        "createdBy",
        "updatedBy",
        "module",
        "signatoryDetails",
        "signatoryDetails.status",
        "signatoryDetails.createdBy",
        "signatoryDetails.updatedBy",
        "signatoryDetails.signatoryType",
        "signatoryDetails.signatoree",
        "signatoryDetails.position",
      ],
    });

    return signatoryHeaders.map((entity) => ({
      id: entity.id,
      status_id: entity.status_id,
      created_by: entity.created_by,
      updated_by: entity.updated_by,
      access_key_id: entity.access_key_id,
      module_id: entity.module_id,
      created_at: entity.created_at,
      modified_at: entity.modified_at,

      created_user: entity.createdBy?.first_name || null,
      updated_user: entity.updatedBy?.first_name || null,
      status_name: entity.status?.status_name || null,
      module_name: entity.module?.module_name || null,

      // Only get ACTIVE signatory details
      signatoryDetails: (entity.signatoryDetails || [])
        .filter((detail) => detail.status_id === STATUS_IDS.ACTIVE)
        .map((detail) => ({
          id: detail.id,
          signatory_header_id: detail.signatory_header_id,
          status_id: detail.status_id,
          created_by: detail.created_by,
          updated_by: detail.updated_by,
          signatory_type_id: detail.signatory_type_id,
          signatoree_id: detail.signatoree_id,
          position_id: detail.position_id,
          created_at: detail.created_at,
          modified_at: detail.modified_at,

          created_user: detail.createdBy?.first_name || null,
          updated_user: detail.updatedBy?.first_name || null,
          status_name: detail.status?.status_name || null,

          signatory_type_name: detail.signatoryType?.description || null,
          signatory_type_code: detail.signatoryType?.code || null,

          signatoree_name: detail.signatoree
            ? `${detail.signatoree.first_name || ""} ${detail.signatoree.last_name || ""}`.trim()
            : null,

          position_name: detail.position?.position_name || null,
        })),
    }));
  } catch (error) {
    console.error("Error fetching signatory headers:", error);
    throw new Error("Failed to fetch signatory headers");
  }
}

  async findSignatoryDetails(headerId: number): Promise<any[]> {
    try {
      const signatoryDetails = await this.signatoryDetailRepository.find({
        where: {
          signatoryHeader: {
            id: headerId,
          },
        },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "signatoryHeader.module",
          "signatoryType",
          "signatoree",
          "position",
        ],
      });
      return this.responseMapperService.mapEntitiesToResponse(signatoryDetails);
    } catch (error) {
      console.error("Error fetching signatory details:", error);
      throw new Error("Failed to fetch signatory details");
    }
  }
  async findSignatoryType(): Promise<any[]> {
    try {
      const signatoryDetails = await this.signatoryTypeRepository.find({
        where: { status_id: STATUS_IDS.ACTIVE },
        relations: ["status", "createdBy", "updatedBy"],
      });
      return this.responseMapperService.mapEntitiesToResponse(signatoryDetails);
    } catch (error) {
      console.error("Error fetching signatory details:", error);
      throw new Error("Failed to fetch signatory details");
    }
  }

async findBySignatoreeByModule(
  moduleName: string,
  accessKeyId: number,
): Promise<any[]> {
  try {

    const signatoryDetails = await this.signatoryDetailRepository.find({
      where: {
        signatoryHeader: {
          module: {
            module_name: moduleName,
          },
          status_id: STATUS_IDS.ACTIVE,
          access_key_id: accessKeyId,
        },
      },
      relations: [
        "status",
        "createdBy",
        "updatedBy",
        "signatoryHeader",
        "signatoryHeader.module",
        "signatoryType",
        "position",
        "signatoree",
      ],
    });

    return this.responseMapperService.mapEntitiesToResponse(signatoryDetails);
  } catch (error) {
    console.error("Error fetching signatory details by module:", error);
    throw new Error("Failed to fetch signatory details");
  }
}

  async create(
    createDto: CreateSignatoryHeaderDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    try {
      // Validate authenticated user
      const createdByUser = await this.usersService.findUserById(userId);

      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Check existing signatory details for the same module and type
      for (const detail of createDto.details) {
        const existingDetail = await this.signatoryDetailRepository
          .createQueryBuilder("detail")
          .innerJoin("detail.signatoryHeader", "header")
          .innerJoin("header.module", "module")
          .where("header.module_id = :module_id", {
            module_id: createDto.module_id,
          })
          .andWhere("header.status_id = :headerStatusId", {
            headerStatusId: STATUS_IDS.ACTIVE,
          })
          .andWhere("detail.signatory_type_id = :signatory_type_id", {
            signatory_type_id: detail.signatory_type_id,
          })
          .andWhere("detail.position_id = :position_id", {
            position_id: detail.position_id,
          })
          .andWhere("detail.signatoree_id = :signatoree_id", {
            signatoree_id: detail.signatoree_id,
          })
          .andWhere("detail.status_id = :detailStatusId", {
            detailStatusId: STATUS_IDS.ACTIVE,
          })
          .select("module.module_name", "module_name")
          .getRawOne();

        if (existingDetail) {
          throw new BadRequestException(
            `This signatory configuration already exists for module ${existingDetail.module_name}`,
          );
        }
      }

      // Create header
      const newHeader = this.signatoryHeaderRepository.create({
        module_id: createDto.module_id,
        status_id: STATUS_IDS.ACTIVE,
        access_key_id: accessKeyId,
        created_by: userId,
        updated_by: userId,
      });

      const savedHeader = await this.signatoryHeaderRepository.save(newHeader);

      // Create details
      const newDetails = createDto.details.map((detail) =>
        this.signatoryDetailRepository.create({
          signatory_header_id: savedHeader.id,
          signatory_type_id: detail.signatory_type_id,
          position_id: detail.position_id,
          signatoree_id: detail.signatoree_id,
          status_id: STATUS_IDS.ACTIVE,
          created_by: userId,
          updated_by: userId,
        }),
      );

      const savedDetails =
        await this.signatoryDetailRepository.save(newDetails);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SignatoryService",
          method: "create",
          raw_data: JSON.stringify({
            header: savedHeader,
            details: savedDetails,
          }),
          description: `Created signatory header ${savedHeader.id} for module ${savedHeader.module_id}`,
          status_id: 1,
        },
        userId,
      );

      // Retrieve header with relations
      const headerWithRelations = await this.signatoryHeaderRepository.findOne({
        where: { id: savedHeader.id },
        relations: ["status", "createdBy", "updatedBy", "module"],
      });

      if (!headerWithRelations) {
        throw new Error("Failed to retrieve created signatory header");
      }

      // Retrieve details with relations
      const detailsWithRelations = await this.signatoryDetailRepository.find({
        where: {
          signatory_header_id: savedHeader.id,
          status_id: STATUS_IDS.ACTIVE,
        },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "signatoryHeader.module",
          "signatoryType",
          "position",
        ],
      });

      const response = {
        ...this.responseMapperService.mapEntityToResponse(headerWithRelations),
        details:
          this.responseMapperService.mapEntitiesToResponse(
            detailsWithRelations,
          ),
      };

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("signatories", response.id, response);
        this.sseEventEmitter.emitUpdate("billing_schedule_report", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error("Error creating signatory header:", error);
      throw new Error("Failed to create signatory header and details");
    }
  }

  async update(
    id: number,
    updateDto: UpdateSignatoryHeaderDto,
    accessKeyId: number,
    userId: number,
  ): Promise<any> {
    try {
      // Find existing header
      const existingHeader = await this.signatoryHeaderRepository.findOne({
        where: {
          id,
          status_id: STATUS_IDS.ACTIVE,
        },
      });

      if (!existingHeader) {
        throw new NotFoundException("Signatory header not found");
      }

      // Validate authenticated user
      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Update header
      await this.signatoryHeaderRepository.update(id, {
        module_id: updateDto.module_id ?? existingHeader.module_id,
        updated_by: userId,
      });

      // Update details only when details are provided
      if (updateDto.details !== undefined) {
        const existingDetails = await this.signatoryDetailRepository.find({
          where: {
            signatory_header_id: id,
            status_id: STATUS_IDS.ACTIVE,
          },
        });

        // Use the updated module_id, or retain the existing one
        const moduleId = updateDto.module_id ?? existingHeader.module_id;

        const moduleInfo = await this.signatoryDetailRepository.manager
          .createQueryBuilder()
          .select("module.module_name", "module_name")
          .from("module", "module")
          .where("module.id = :moduleId", { moduleId })
          .getRawOne();

        const moduleName = moduleInfo?.module_name || "Unknown Module";

        // Validate submitted details
        const checkedConfigurations = new Set<string>();

        for (const detail of updateDto.details) {
          // Resolve values for existing details or new details
          const currentDetail = detail.id
            ? existingDetails.find((item) => item.id === detail.id)
            : null;

          if (detail.id && !currentDetail) {
            throw new BadRequestException(
              `Signatory detail ID ${detail.id} does not belong to this header`,
            );
          }

          const signatoryTypeId =
            detail.signatory_type_id ?? currentDetail?.signatory_type_id;

          const positionId = detail.position_id ?? currentDetail?.position_id;

          const signatoreeId =
            detail.signatoree_id ?? currentDetail?.signatoree_id;

          // Check duplicate configurations within the submitted details
          const configurationKey = [
            moduleId,
            signatoryTypeId,
            positionId,
            signatoreeId,
          ].join("-");

          if (checkedConfigurations.has(configurationKey)) {
            throw new BadRequestException(
              `This signatory configuration already exists for module ${moduleName}`,
            );
          }

          checkedConfigurations.add(configurationKey);

          // Check existing active configurations in the database
          const query = this.signatoryDetailRepository
            .createQueryBuilder("detail")
            .innerJoin("detail.signatoryHeader", "header")
            .where("header.module_id = :module_id", {
              module_id: moduleId,
            })
            .andWhere("header.status_id = :headerStatusId", {
              headerStatusId: STATUS_IDS.ACTIVE,
            })
            .andWhere("detail.signatory_type_id = :signatory_type_id", {
              signatory_type_id: signatoryTypeId,
            })
            .andWhere("detail.position_id = :position_id", {
              position_id: positionId,
            })
            .andWhere("detail.signatoree_id = :signatoree_id", {
              signatoree_id: signatoreeId,
            })
            .andWhere("detail.status_id = :detailStatusId", {
              detailStatusId: STATUS_IDS.ACTIVE,
            });

          // Exclude only the current detail being updated
          if (detail.id) {
            query.andWhere("detail.id != :detailId", {
              detailId: detail.id,
            });
          }

          const existingConfiguration = await query.getOne();

          if (existingConfiguration) {
            throw new BadRequestException(
              `This signatory configuration already exists for module ${moduleName}`,
            );
          }
        }

        const submittedDetailIds = updateDto.details
          .filter((detail) => detail.id)
          .map((detail) => detail.id);

        // Deactivate details removed from the request
        const detailsToDeactivate = existingDetails.filter(
          (detail) => !submittedDetailIds.includes(detail.id),
        );

        if (detailsToDeactivate.length > 0) {
          await this.signatoryDetailRepository.update(
            detailsToDeactivate.map((detail) => detail.id),
            {
              status_id: STATUS_IDS.INACTIVE,
              updated_by: userId,
            },
          );
        }

        // Update existing details or create new ones
        for (const detail of updateDto.details) {
          if (detail.id) {
            const existingDetail = existingDetails.find(
              (item) => item.id === detail.id,
            );

            if (!existingDetail) {
              throw new BadRequestException(
                `Signatory detail ID ${detail.id} does not belong to this header`,
              );
            }

            await this.signatoryDetailRepository.update(detail.id, {
              signatory_type_id:
                detail.signatory_type_id ?? existingDetail.signatory_type_id,
              position_id: detail.position_id ?? existingDetail.position_id,
              signatoree_id:
                detail.signatoree_id ?? existingDetail.signatoree_id,
              updated_by: userId,
            });
          } else {
            const newDetail = this.signatoryDetailRepository.create({
              signatory_header_id: id,
              signatory_type_id: detail.signatory_type_id,
              position_id: detail.position_id,
              signatoree_id: detail.signatoree_id,
              status_id: STATUS_IDS.ACTIVE,
              created_by: userId,
              updated_by: userId,
            });

            await this.signatoryDetailRepository.save(newDetail);
          }
        }
      }

      // Audit trail
      const updatedHeader = await this.signatoryHeaderRepository.findOne({
        where: { id },
      });

      await this.userAuditTrailCreateService.create(
        {
          service: "SignatoryService",
          method: "update",
          raw_data: JSON.stringify({
            header: updatedHeader,
            details: updateDto.details,
          }),
          description: `Updated signatory header ${id}`,
          status_id: 1,
        },
        userId,
      );

      // Retrieve updated header with relations
      const headerWithRelations = await this.signatoryHeaderRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "module"],
      });

      if (!headerWithRelations) {
        throw new Error("Failed to retrieve updated signatory header");
      }

      // Retrieve updated details
      const detailsWithRelations = await this.signatoryDetailRepository.find({
        where: {
          signatory_header_id: id,
          status_id: STATUS_IDS.ACTIVE,
        },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "signatoryHeader.module",
          "signatoryType",
          "position",
        ],
      });

      const response = {
        ...this.responseMapperService.mapEntityToResponse(headerWithRelations),
        details:
          this.responseMapperService.mapEntitiesToResponse(
            detailsWithRelations,
          ),
      };

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("signatories", response.id, response);
        this.sseEventEmitter.emitUpdate("billing_schedule_report", 0);
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error("Error updating signatory header:", error);
      throw new Error("Failed to update signatory header and details");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const signatory = await this.signatoryHeaderRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!signatory) {
        throw new NotFoundException(`Signatory with ID ${id} not found`);
      }

      const newStatusId = signatory.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.signatoryHeaderRepository.update(id, {
        status_id: newStatusId,
      });

      const updateSignatory = await this.signatoryHeaderRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updateSignatory) {
        throw new Error("Failed to retrieve updated Signatory");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SignatoryService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updateSignatory),
          description: `Toggled status for Signatory`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updateSignatory);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("signatories", response.id, response);
        this.sseEventEmitter.emitUpdate("billing_schedule_report", 0);
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
      throw new Error("Failed to toggle status for signatories");
    }
  }
}
