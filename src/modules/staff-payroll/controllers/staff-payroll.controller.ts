import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffPayrollService } from "src/modules/staff-payroll/services/staff-payroll.service";
import { CreatePayrollHeaderDto } from "src/modules/staff-payroll/dto/CreatePayrollHeaderDto";
import { UpdatePayrollHeaderDto } from "src/modules/staff-payroll/dto/UpdatePayrollHeaderDto";
import { FindStaffPayrollDetailsDto } from "src/modules/staff-payroll/dto/FindStaffPayrollDetailsDto";

@Controller("staffs-payroll")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffPayrollController {
  constructor(private readonly staffPayrollService: StaffPayrollService) {}

  @Get()
  @RequirePermissions({ module: "STAFF PAYROLL", action: "VIEW" })
  async findAll(@Query("status_id") statusId?: string , @Request() req?: any,) {
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    const accessKeyId = req?.user?.current_access_key;
    return this.staffPayrollService.findAll(parsedStatusId, accessKeyId);
  }

  @Post("generate-staff-payroll")
  @RequirePermissions({ module: "STAFF PAYROLL", action: "ADD" })
  async findStaffPayrollDetails(@Body() findStaffPayrollDetails: FindStaffPayrollDetailsDto,@Request() req) {
    const accessKeyId = req.user.current_access_key;
    return this.staffPayrollService.findStaffPayrollDetails(accessKeyId,findStaffPayrollDetails);
  }

  @Post("compute-staff-payroll")
  @RequirePermissions({ module: "STAFF PAYROLL", action: "ADD" })
  async computePayroll(@Body() createPayrollHeaderDto: CreatePayrollHeaderDto,@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    return this.staffPayrollService.computePayroll(accessKeyId,createPayrollHeaderDto,userId);
  }



}
