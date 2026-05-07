import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { TransactionsService } from "../../transactions/services/transactions.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { WarehouseRequirementsService } from "src/modules/warehouse-requirements/services/warehouse-requirements.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly service: TransactionsService,
    private readonly warehouseRequirementsService: WarehouseRequirementsService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "DASHBOARD", action: "VIEW" })
  @Get()
  async getTransactionDashboard(
    @Query("location_ids") location_ids?: string,
    @Query("trans_date") trans_date?: string,
    @Query("warehouse_id") warehouse_id?: number,
    @Query("status_id") status_id?: number,
    @Req() req?: any,
  ) {
    // Parse location_ids as array of numbers if provided
    let locationIdsArr: number[] | undefined = undefined;
    if (location_ids) {
      locationIdsArr = location_ids
        .split(",")
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));
    }
    const user = req?.user || {};
    return this.service.generateTransactionReport({
      location_ids: locationIdsArr,
      trans_date,
      warehouse_id: warehouse_id ? Number(warehouse_id) : undefined,
      status_id: status_id ? Number(status_id) : undefined,
      user_id: user.id,
      role_id: user.role_id,
      current_access_key: user.current_access_key,
    });
  }

  /**
   * Get warehouse requirements report per location
   * GET /warehouse-requirements/report/per-location
   * Shows requirement counts and percentages grouped by location
   */
  @Get("warehouse-req-per-location")
  @RequirePermissions({
    module: "STORE REQUIREMENTS DASHBOARD",
    action: "VIEW",
  })
  async getWarehouseRequirementsPerLocation(
    @Query("warehouse_type_id", ParseIntPipe) warehouse_type_id: number,
    @Query("location_ids") location_ids?: string,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Query("status_id") status_id?: number,
    @Query("store_status_ids") store_status_ids?: string,
    @Req() req?: any,
  ) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const accessKeyId = req.user.current_access_key;
    const warehouseRemStatusId: number[] = store_status_ids
      ? store_status_ids.split(",").map((id) => Number(id.trim()))
      : [8];

    return await this.warehouseRequirementsService.getWarehouseRequirementsListingPerLocation(
      warehouse_type_id,
      location_ids,
      date_from,
      date_to,
      status_id,
      userId,
      roleId,
      accessKeyId,
      warehouseRemStatusId,
    );
  }
}
