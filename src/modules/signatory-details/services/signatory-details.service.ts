import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository,Raw } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { CreateSignatoryDetailDto } from "src/modules/signatory-details/dto/CreateSignatoryDto";
import { UpdateSignatoryDetailDto } from "src/modules/signatory-details/dto/UpdateSignatoryDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { SignatoryHeader } from "src/entities/SignatoryHeader";
import { SignatoryType } from "src/entities/SignatoryTypes";
import { Position } from "src/entities/Position";
import { SignatoryDetail } from "src/entities/SignatoryDetails";

@Injectable()
export class SignatoryDetailService {
  constructor(
    @InjectRepository(SignatoryDetail)
    private signatoryDetailRepository: Repository<SignatoryDetail>,
    @InjectRepository(SignatoryType)
    private signatoryTypeRepository: Repository<SignatoryType>,
    @InjectRepository(SignatoryHeader)
    private signatorHeaderRepository: Repository<SignatoryHeader>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const signatoryDetails = await this.signatoryDetailRepository.find({
        relations: ["status", "createdBy", "updatedBy", "signatoryHeader", "signatoryType", "position"],
      });

      return this.responseMapperService.mapEntitiesToResponse(signatoryDetails);
    } catch (error) {
      console.error("Error fetching signatory details:", error);
      throw new Error("Failed to fetch signatory details");
    }
  }



}
