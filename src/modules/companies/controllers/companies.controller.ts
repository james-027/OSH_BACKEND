import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
// import { CompaniesService } from "../services/companies.service";
import { CompaniesService } from "src/modules/companies/services/companies.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { CreateCompanyDto } from "src/modules/companies/dto/CreateCompanyDto";
import { UpdateCompanyDto } from "src/modules/companies/dto/UpdateCompanyDto";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("companies")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions({ module: "COMPANIES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.companiesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "COMPANIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "COMPANIES", action: "ADD" })
  async create(@Body() createCompanyDto: CreateCompanyDto, @Request() req) {
    const userId = req.user.id;
    return this.companiesService.create(createCompanyDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "COMPANIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.companiesService.update(id, updateCompanyDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "COMPANIES", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.companiesService.remove(id);
  }
  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "COMPANIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.companiesService.toggleStatus(id, userId);
  }
  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "COMPANIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.companiesService.toggleStatus(id, userId);
  }
}
