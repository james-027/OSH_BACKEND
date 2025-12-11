import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Patch,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { WarehousesService } from "../services/warehouses.service";
import { WarehouseRequirementsService } from "../services/warehouse-requirements.service";
import { CreateWarehouseRequirementDto } from "../dto/CreateWarehouseRequirementDto";
import { UpdateWarehouseRequirementDto } from "../dto/UpdateWarehouseRequirementDto";

@Controller("warehouse-requirements")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseRequirementsController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly warehouseRequirementsService: WarehouseRequirementsService
  ) {}

  @Get("/stores/:warehouse_type_id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAll(
    @Param("warehouse_type_id", ParseIntPipe) warehouseTypeId: number,
    @Request() req
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    return this.warehousesService.findAll(
      warehouseTypeId,
      accessKeyId,
      userId,
      roleId
    );
  }

  @Get("/stores/:warehouse_type_id/:status_id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAllPerStatus(
    @Param("warehouse_type_id", ParseIntPipe) warehouseTypeId: number,
    @Param("status_id", ParseIntPipe) statusId: number,
    @Request() req
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    return this.warehousesService.findAllPerStatus(
      warehouseTypeId,
      statusId,
      accessKeyId,
      userId,
      roleId
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }

  /**
   * Get warehouses with base and transacted requirements listing
   * GET /warehouse-requirements/stores/:warehouse_type_id/active-stores
   * Optional: warehouse_id, date_from, date_to
   */
  @Get("stores/:warehouse_type_id/active-stores-requirements")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async getWarehouseRequirementsListing(
    @Param("warehouse_type_id", ParseIntPipe) warehouse_type_id: number,
    @Query("warehouse_id") warehouse_id?: number,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Query("flatten") flatten?: boolean,
    @Request() req?: any
  ) {
    const userId = req?.user?.id;
    const roleId = req?.user?.roleId;
    const accessKeyId = req?.user?.accessKeyId;

    return await this.warehouseRequirementsService.getWarehouseRequirementsListingOptimized(
      warehouse_type_id,
      warehouse_id ? Number(warehouse_id) : undefined,
      date_from,
      date_to,
      userId,
      roleId,
      accessKeyId,
      flatten
    );
  }

  @Get("stores/:warehouse_type_id/count-active-stores-requirements")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async getWarehouseRequirementsListingCounts(
    @Param("warehouse_type_id", ParseIntPipe) warehouse_type_id: number,
    @Query("warehouse_id") warehouse_id?: number,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Request() req?: any
  ) {
    const userId = req?.user?.id;
    const roleId = req?.user?.roleId;
    const accessKeyId = req?.user?.accessKeyId;

    return await this.warehouseRequirementsService.getWarehouseRequirementsListingCounts(
      warehouse_type_id,
      warehouse_id ? Number(warehouse_id) : undefined,
      date_from,
      date_to,
      userId,
      roleId,
      accessKeyId
    );
  }

  // ==================== Warehouse Requirements Management ====================

  /**
   * Get all warehouse requirements
   * GET /warehouse-requirements
   */
  @Get()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAllRequirements(@Request() req) {
    return this.warehouseRequirementsService.findAll();
  }

  /**
   * Get single warehouse requirement by ID
   * GET /warehouse-requirements/:id
   */
  @Get("view/:id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOneRequirement(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    return this.warehouseRequirementsService.findOne(id);
  }

  /**
   * Create warehouse requirement
   * POST /warehouse-requirements
   */
  @Post()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async createRequirement(
    @Body() createWarehouseRequirementDto: CreateWarehouseRequirementDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.create(
      createWarehouseRequirementDto,
      userId
    );
  }

  /**
   * Update warehouse requirement
   * PUT /warehouse-requirements/:id
   */
  @Put(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "EDIT" })
  async updateRequirement(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateWarehouseRequirementDto: UpdateWarehouseRequirementDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.update(
      id,
      updateWarehouseRequirementDto,
      userId
    );
  }

  /**
   * Activate warehouse requirement
   * PATCH /warehouse-requirements/:id/toggle-status-activate
   */
  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.toggleStatus(id, userId);
  }

  /**
   * Deactivate warehouse requirement
   * PATCH /warehouse-requirements/:id/toggle-status-deactivate
   */
  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.toggleStatus(id, userId);
  }

  /**
   * Manually sync warehouse requirements
   * POST /warehouse-requirements/sync
   */
  @Post("sync")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async manualSync(@Request() req) {
    return this.warehouseRequirementsService.syncWarehouseRequirements();
  }
}
