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
   BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffWarehousesService } from "src/modules/staff-warehouses/services/staff-warehouses.service";
import { CreateStaffWarehouseDto } from "src/modules/staff-warehouses/dto/CreateStaffWarehouseDto";
import { UpdateStaffWarehouseDto } from "src/modules/staff-warehouses/dto/UpdateStaffWarehouseDto";
import { Query } from "@nestjs/common";

@Controller("staff-warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffWarehousesController {
  constructor(
    private readonly staffWarehousesService: StaffWarehousesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "VIEW" })
  async findAll(  @Request() req,
    @Query("approval_status_id") assignStatusId?: string,
    @Query("warehouse_id") warehouseId?: string,
  )  {
    const accessKeyId = req.user.current_access_key;

        const parsedApprovalStatusId = assignStatusId
    ? assignStatusId.split(",").map(Number)
    : undefined;
    
        const parsedWarehouseId = warehouseId
    ? warehouseId.split(",").map(Number)
    : undefined;


    return this.staffWarehousesService.findAll(accessKeyId, parsedApprovalStatusId, parsedWarehouseId);
  }

    @Post("/change-bulk-status")
    @RequirePermissions({ module: "STAFF WAREHOUSES", action: ["POST", "APPROVE"] })
    async toggleBulkStatus(
      @Body() body: { ids: number[]; approval_status_id: number; undo_reason?: string },
      @Request() req,
    ) {
      const userId = req.user.id;
      const { ids, approval_status_id, undo_reason } = body;
      if (!Array.isArray(ids) || typeof approval_status_id !== "number") {
        throw new BadRequestException(
          "Invalid payload: ids and approval_status_id are required.",
        );
      }
      return this.staffWarehousesService.toggleBulkStatus(
        ids,
        approval_status_id,
        userId,
        undo_reason,
      );
    }

  @Get(":id")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffWarehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "ADD" })
  async create(
    @Body() createStaffWarehouseDto: CreateStaffWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffWarehousesService.create(createStaffWarehouseDto, userId,accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffWarehouseDto: UpdateStaffWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.update(
      id,
      updateStaffWarehouseDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.toggleStatus(id, userId);
  }

  @Get("history/:id")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffWarehousesService.findOneHistory(id);
  }

  @Get("find-by-staff")
async findByStaff(
  @Query("staff_code") staffCode: string,
  @Query("warehouse_id") warehouseId: number,
) {
  return this.staffWarehousesService.findByStaff(
    staffCode,
    Number(warehouseId),
  );
}


  
}
