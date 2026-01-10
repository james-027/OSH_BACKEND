import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { TransactionsService } from "../services/transactions.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { WarehouseRequirementsService } from "../services/warehouse-requirements.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly service: TransactionsService,
    private readonly warehouseRequirementsService: WarehouseRequirementsService
  ) {}

  /**
   * GET /transactions/report
   * Query params: location_ids (comma-separated), trans_date (YYYY-MM-DD), warehouse_id, status_id
   * Example: /transactions/report?location_ids=1,2&trans_date=2025-05-01&warehouse_id=5&status_id=4
   *
   * Now requires JWT user (for allowed locations and access_key filtering)
   */
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE REPORTS", action: "VIEW" })
  @Get("incentives")
  async getTransactionReport(
    @Query("location_ids") location_ids?: string,
    @Query("trans_date") trans_date?: string,
    @Query("warehouse_id") warehouse_id?: number,
    @Query("status_id") status_id?: number,
    @Req() req?: any
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
    module: "STORE REQUIREMENTS REPORTS",
    action: "VIEW",
  })
  async getWarehouseRequirementsPerLocation(
    @Query("warehouse_type_id", ParseIntPipe) warehouse_type_id: number,
    @Query("location_ids") location_ids?: string,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Query("status_id") status_id?: number,
    @Req() req?: any
  ) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const accessKeyId = req.user.current_access_key;

    return await this.warehouseRequirementsService.getWarehouseRequirementsListingPerLocation(
      warehouse_type_id,
      location_ids,
      date_from,
      date_to,
      status_id,
      userId,
      roleId,
      accessKeyId
    );
  }

  /**
   * Get warehouse requirements detailed report per store
   * GET /reports/warehouse-req-detailed-per-store
   * Shows requirement details grouped by warehouse with warehouse_requirement_dues included
   * location_ids: Optional comma-separated location IDs (defaults to user's allowed locations)
   * Includes baseRequirements and transactedRequirements with transaction due information
   */
  @Get("warehouse-req-detailed-per-store")
  @RequirePermissions({
    module: "STORE REQUIREMENTS REPORTS",
    action: "VIEW",
  })
  async getWarehouseRequirementsDetailedPerStore(
    @Query("warehouse_type_id", ParseIntPipe) warehouse_type_id: number,
    @Query("location_ids") location_ids?: string,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Query("status_id") status_id?: number,
    @Query("flatten") flatten?: boolean,
    @Req() req?: any
  ) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const accessKeyId = req.user.current_access_key;

    return await this.warehouseRequirementsService.getWarehouseRequirementsListingDetailedPerStore(
      warehouse_type_id,
      location_ids,
      date_from,
      date_to,
      status_id ? Number(status_id) : undefined,
      userId,
      roleId,
      accessKeyId,
      flatten
    );
  }
}
