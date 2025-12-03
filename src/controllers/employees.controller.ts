import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { EmployeesService } from "../services/employees.service";
import { CreateEmployeeDto } from "../dto/CreateEmployeeDto";
import { UpdateEmployeeDto } from "../dto/UpdateEmployeeDto";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../adapters";

@Controller("employees")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions({ module: "EMPLOYEES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return this.employeesService.findAll(accessKeyId, userId, roleId);
  }

  @Get(":id")
  @RequirePermissions({ module: "EMPLOYEES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "EMPLOYEES", action: "ADD" })
  async create(@Body() createEmployeeDto: CreateEmployeeDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    const roleId = req.user.role_id;
    return this.employeesService.create(
      { ...createEmployeeDto, access_key_id: accessKeyId },
      userId,
      roleId
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "EMPLOYEES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req
  ) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return this.employeesService.update(id, updateEmployeeDto, userId, roleId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "EMPLOYEES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "EMPLOYEES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Body("status_id", ParseIntPipe) status_id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.employeesService.toggleStatus(id, status_id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "EMPLOYEES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Body("status_id", ParseIntPipe) status_id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.employeesService.toggleStatus(id, status_id, userId);
  }

  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/employee-upload",
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(new Error("Only Excel files are allowed!"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    })
  )
  @RequirePermissions({ module: "EMPLOYEES", action: "ADD" })
  async uploadExcelEmployees(@UploadedFile() file: FileType, @Request() req) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const accessKeyId = req.user.current_access_key;
    const result = await this.employeesService.uploadExcelEmployees(
      file.path,
      userId,
      roleId,
      accessKeyId
    );
    return result;
  }
}
