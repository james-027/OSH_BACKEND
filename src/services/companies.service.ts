import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Company } from "../entities/Company";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { CreateCompanyDto } from "../dto/CreateCompanyDto";
import { UpdateCompanyDto } from "../dto/UpdateCompanyDto";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const companies = await this.companiesRepository.find({
        relations: ["status", "createdBy", "updatedBy"],
      });

      return companies.map((company) => ({
        id: company.id,
        company_name: company.company_name,
        company_abbr: company.company_abbr,
        status_id: company.status_id,
        created_at: company.created_at,
        created_by: company.created_by,
        updated_by: company.updated_by,
        modified_at: company.modified_at,
        created_user: company.createdBy
          ? `${company.createdBy.first_name} ${company.createdBy.last_name}`
          : null,
        updated_user: company.updatedBy
          ? `${company.updatedBy.first_name} ${company.updatedBy.last_name}`
          : null,
        status_name: company.status ? company.status.status_name : null,
      }));
    } catch (error) {
      console.error("Error fetching companies:", error);
      throw new Error("Failed to fetch companies");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const company = await this.companiesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      return {
        id: company.id,
        company_name: company.company_name,
        company_abbr: company.company_abbr,
        status_id: company.status_id,
        created_at: company.created_at,
        created_by: company.created_by,
        updated_by: company.updated_by,
        modified_at: company.modified_at,
        created_user: company.createdBy
          ? `${company.createdBy.first_name} ${company.createdBy.last_name}`
          : null,
        updated_user: company.updatedBy
          ? `${company.updatedBy.first_name} ${company.updatedBy.last_name}`
          : null,
        status_name: company.status ? company.status.status_name : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching company:", error);
      throw new Error("Failed to fetch company");
    }
  }

  async create(
    createCompanyDto: CreateCompanyDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if company with this name or abbreviation already exists
      const existingCompany = await this.companiesRepository.findOne({
        where: [
          { company_name: createCompanyDto.company_name },
          { company_abbr: createCompanyDto.company_abbr },
        ],
      });

      if (existingCompany) {
        throw new BadRequestException(
          "Company with this name or abbreviation already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newCompany = this.companiesRepository.create({
        company_name: createCompanyDto.company_name.toUpperCase(),
        company_abbr: createCompanyDto.company_abbr,
        status_id: createCompanyDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedCompany = await this.companiesRepository.save(newCompany);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CompaniesService",
          method: "create",
          raw_data: JSON.stringify(savedCompany),
          description: `Created company ${savedCompany.id} - ${savedCompany.company_name} | ${savedCompany.company_abbr}`,
          status_id: 1,
        },
        userId
      );

      const companyWithRelations = await this.companiesRepository.findOne({
        where: { id: savedCompany.id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!companyWithRelations) {
        throw new Error("Failed to retrieve created company");
      }

      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal(
          "companies",
          companyWithRelations.id
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return {
        id: companyWithRelations.id,
        company_name: companyWithRelations.company_name,
        company_abbr: companyWithRelations.company_abbr,
        status_id: companyWithRelations.status_id,
        created_at: companyWithRelations.created_at,
        created_by: companyWithRelations.created_by,
        updated_by: companyWithRelations.updated_by,
        modified_at: companyWithRelations.modified_at,
        created_user: companyWithRelations.createdBy
          ? `${companyWithRelations.createdBy.first_name} ${companyWithRelations.createdBy.last_name}`
          : null,
        updated_user: companyWithRelations.updatedBy
          ? `${companyWithRelations.updatedBy.first_name} ${companyWithRelations.updatedBy.last_name}`
          : null,
        status_name: companyWithRelations.status
          ? companyWithRelations.status.status_name
          : null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create company");
    }
  }

  async update(
    id: number,
    updateCompanyDto: UpdateCompanyDto,
    userId: number
  ): Promise<any> {
    try {
      const company = await this.companiesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      // Check for unique constraints if updating name or abbreviation
      if (updateCompanyDto.company_name || updateCompanyDto.company_abbr) {
        const whereConditions = [];
        if (updateCompanyDto.company_name) {
          whereConditions.push({ company_name: updateCompanyDto.company_name });
        }
        if (updateCompanyDto.company_abbr) {
          whereConditions.push({ company_abbr: updateCompanyDto.company_abbr });
        }

        const existingCompany = await this.companiesRepository.findOne({
          where: whereConditions,
        });

        if (existingCompany && existingCompany.id !== id) {
          throw new BadRequestException(
            "Company with this name or abbreviation already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateCompanyDto.company_name) {
        updateCompanyDto.company_name =
          updateCompanyDto.company_name.toUpperCase();
      }
      Object.assign(company, updateCompanyDto, {
        updated_by: userId,
      });
      await this.companiesRepository.save(company);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CompaniesService",
          method: "update",
          raw_data: JSON.stringify(company),
          description: `Updated company ${id} - ${company.company_name} | ${company.company_abbr}`,
          status_id: 1,
        },
        userId
      );

      const updatedCompany = await this.companiesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedCompany) {
        throw new Error("Failed to retrieve updated company");
      }

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("companies", updatedCompany.id);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedCompany.id,
        company_name: updatedCompany.company_name,
        company_abbr: updatedCompany.company_abbr,
        status_id: updatedCompany.status_id,
        created_at: updatedCompany.created_at,
        created_by: updatedCompany.created_by,
        updated_by: updatedCompany.updated_by,
        modified_at: updatedCompany.modified_at,
        created_user: updatedCompany.createdBy
          ? `${updatedCompany.createdBy.first_name} ${updatedCompany.createdBy.last_name}`
          : null,
        updated_user: updatedCompany.updatedBy
          ? `${updatedCompany.updatedBy.first_name} ${updatedCompany.updatedBy.last_name}`
          : null,
        status_name: updatedCompany.status
          ? updatedCompany.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to update company");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const company = await this.companiesRepository.findOne({
        where: { id },
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      await this.companiesRepository.remove(company);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting company:", error);
      throw new Error("Failed to delete company");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const company = await this.companiesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      const newStatusId = company.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.companiesRepository.update(id, {
        status_id: newStatusId,
      });
      const updatedCompany = await this.companiesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });
      if (!updatedCompany) {
        throw new Error("Failed to retrieve updated company");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CompaniesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedCompany),
          description: `Toggled status for company ${id} - ${company.company_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("companies", updatedCompany.id);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedCompany.id,
        company_name: updatedCompany.company_name,
        company_abbr: updatedCompany.company_abbr,
        status_id: updatedCompany.status_id,
        created_at: updatedCompany.created_at,
        created_by: updatedCompany.created_by,
        updated_by: updatedCompany.updated_by,
        modified_at: updatedCompany.modified_at,
        created_user: updatedCompany.createdBy
          ? `${updatedCompany.createdBy.first_name} ${updatedCompany.createdBy.last_name}`
          : null,
        updated_user: updatedCompany.updatedBy
          ? `${updatedCompany.updatedBy.first_name} ${updatedCompany.updatedBy.last_name}`
          : null,
        status_name: updatedCompany.status
          ? updatedCompany.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to toggle status for company");
    }
  }
}
