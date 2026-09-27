import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { WorkingDay } from "src/entities/WorkingDay";
import { CreateTrainingDto } from "src/modules/trainings/dto/CreateTrainingDto";
import { UpdateTrainingDto } from "src/modules/trainings/dto/UpdateTrainingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { STATUS_IDS } from "src/constants/customConstants";

@Injectable()
export class WorkingDaysService {
  constructor(
    @InjectRepository(WorkingDay)
    private workingdaysRepository: Repository<WorkingDay>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {

    try {
      const where: any = {};

      where.status_id = STATUS_IDS.ACTIVE;
      const workingDays = await this.workingdaysRepository.find({
        where,
        relations: [
          "status",
          "createdBy",
          "updatedBy",
        ],
      });

      return this.responseMapperService.mapEntitiesToResponse(workingDays);
    } catch (error) {
      console.error("Error fetching trainings:", error);
      throw new Error("Failed to fetch trainings");
    }
  }


}
