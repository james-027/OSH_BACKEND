import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import {
  STATUS_IDS,
} from "src/constants/customConstants";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { ActualLogsDetail } from "src/entities/ActualLogsDetail";
import { ActualLogsHeader } from "src/entities/ActualLogsHeader";

@Injectable()
export class ActualTimeLogDetailService {
  constructor(
    @InjectRepository(ActualLogsDetail)
    private actualLogsDetailRepository: Repository<ActualLogsDetail>,
    @InjectRepository(ActualLogsHeader)
    private actualLogsHeaderRepository: Repository<ActualLogsHeader>,
    private actionLogsService: ActionLogsService,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  private readonly module_name = "ACTUAL TIME LOGS";


//   async findAll(
//   statusId?: number[],
//   accessKeyId?: number,
//   userId?: number,
//   roleId?: number,
// ): Promise<any[]> {
//   try {
//     const where: any = {
//       actualHeader: {},
//     };

//     if (accessKeyId !== undefined) {
//       where.actualHeader.access_key_id = accessKeyId;
//     }

//     if (userId && roleId) {
//       const allowedLocationIds =
//         await this.commonUtilitiesService.getUserAllowedLocationIds(
//           userId,
//           roleId,
//         );

//       where.location_id = In(allowedLocationIds);
//     }

//     if (statusId && statusId.length > 0) {
//       where.actualHeader.status_id = In(statusId);
//     }

//     const actualLogsDetail = await this.actualLogsDetailRepository.find({
//       where,
//       relations: [
//         "status",
//         "staff",
//         "staff.position",
//         "actualHeader",
//         "actualHeader.status",
//         "actualHeader.logsType",
//         "warehouse",
//         "vendor",
//         "createdBy",
//         "updatedBy",
//       ],
//       order: {
//         modified_at: "DESC",
//       },
//     });

//     return this.responseMapperService.mapEntitiesToResponse(
//       actualLogsDetail,
//     );
//   } catch (error) {
//     console.error("Error fetching staffs:", error);
//     throw new Error("Failed to fetch staffs");
//   }
// }


async findAll(
  statusId?: number[],
  accessKeyId?: number,
  userId?: number,
  roleId?: number,
): Promise<any[]> {
  try {
    const where: any = {};

    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }

    if (statusId && statusId.length > 0) {
      where.status_id = In(statusId);
    }

    const actualLogsHeader =
      await this.actualLogsHeaderRepository.find({
        where,
        relations: [
          "status",
          "updatedBy",
          "details",
          "details.location",
          "details.vendor",
        ],
        order: {
          modified_at: "DESC",
        },
      });

      const mappedHeaders =
        this.responseMapperService.mapEntitiesToResponse(actualLogsHeader);

      return mappedHeaders.map((mappedHeader, index) => {
        const originalHeader = actualLogsHeader[index];

        const firstDetail = originalHeader.details?.[0];

        return {
          ...mappedHeader,

          location_name: firstDetail?.location?.location_name ?? null,
          vendor_name: firstDetail?.vendor?.service_provider_name ?? null,
        };
      });
  } catch (error) {
    console.error("Error fetching actual logs headers:", error);
    throw new Error("Failed to fetch actual logs headers");
  }
}




  async findOne(id: number): Promise<any> {
    try {
      const staff = await this.actualLogsDetailRepository.findOne({
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


    async findActualHeaderDetails(
      scheduleHeaderId?: number,
      accessKeyId?: number,
      userId?: number,
      roleId?: number,
    ): Promise<any[]> {
      try {
        const where: any = {};
  
        if (scheduleHeaderId !== undefined) {
          where.actual_header_id = scheduleHeaderId;
        }
  
        if (userId && roleId) {
          const allowedLocationIds =
            await this.commonUtilitiesService.getUserAllowedLocationIds(
              userId,
              roleId,
            );
          where.location_id = In(allowedLocationIds);
        }
  
        if (accessKeyId !== undefined) {
          where.actualHeader = {
            access_key_id: accessKeyId,
          };
        }
  
      const actualLogsDetail = await this.actualLogsDetailRepository.find({
        where,
        relations: [
          "status",
          "staff",
          "staff.position",
          "actualHeader",
          "actualHeader.status",
          "actualHeader.logsType",
          "warehouse",
          "vendor",
          "createdBy",
          "updatedBy",
        ],
        order: {
          modified_at: "DESC",
        },
      });
  
        const mappedDetails =
          this.responseMapperService.mapEntitiesToResponse(actualLogsDetail);
  
        return mappedDetails.map((detail) => ({
          ...detail,
  
        }));
      } catch (error) {
        console.error("Error fetching staff schedule:", error);
  
        throw new Error("Failed to fetch staff schedule");
      }
    }

  async findOneHistory(ref_id: number) {
    // const module_id = MODULE_IDS.STAFFS;
    return this.actionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }


}
