import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Put,
  Delete,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { NotificationsService } from "../services/notifications.service";
import { CreateNotificationDto } from "../dto/CreateNotificationDto";
import { UpdateNotificationDto } from "../dto/UpdateNotificationDto";
import {
  CreateNotificationMatrixDto,
  UpdateNotificationMatrixDto,
} from "../dto/NotificationMatrixDto";
import {
  NotificationQueryDto,
  AdminNotificationAuditDto,
} from "../dto/NotificationQueryDto";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // =========================================================================
  // 1. END-USER / RECIPIENT ENDPOINTS (Bell count, user feed, read state)
  // =========================================================================

  /**
   * Get logged-in user's notifications with pagination, filters, and unread counts
   */
  @Get("my")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "DATA ACCESS" })
  getMyNotifications(@Req() req: any, @Query() query: NotificationQueryDto) {
    const userId = req.user?.id || 0;
    return this.notificationsService.getMyNotifications(userId, query);
  }

  /**
   * Get instant unread notification count for notification bell badge
   */
  @Get("unread-count")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "DATA ACCESS" })
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id || 0;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark all unread notifications as read for current user
   */
  @Patch("mark-all-read")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "DATA ACCESS" })
  markAllAsRead(@Req() req: any) {
    const userId = req.user?.id || 0;
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Mark single notification as read for current user
   */
  @Patch(":id/read")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "DATA ACCESS" })
  markAsRead(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || 0;
    return this.notificationsService.markAsRead(id, userId);
  }

  // =========================================================================
  // 2. SYSTEM ADMIN OVERALL VIEW / AUDIT TRAIL
  // =========================================================================

  /**
   * System Admin overall view: See all notifications, recipient delivery status,
   * and which team members (e.g. payroll) have marked as read with timestamps.
   */
  @RequirePermissions({ module: "NOTIFICATIONS", action: "VIEW" })
  @Get("admin/audit")
  getAdminAuditTrail(@Query() query: AdminNotificationAuditDto) {
    return this.notificationsService.getAdminAuditTrail(query);
  }

  // =========================================================================
  // 3. DYNAMIC NOTIFICATION MATRIX CONFIGURATION (ADMIN SETTINGS)
  // =========================================================================

  @Get("matrix/events/catalog")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "VIEW" })
  getEventCatalog() {
    return this.notificationsService.getEventCatalog();
  }

  @Get("matrix")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "VIEW" })
  findAllMatrix() {
    return this.notificationsService.findAllMatrix();
  }

  @Get("matrix/:id")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "VIEW" })
  findOneMatrix(@Param("id", ParseIntPipe) id: number) {
    return this.notificationsService.findOneMatrix(id);
  }

  @Post("matrix")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "ADD" })
  createMatrix(@Body() dto: CreateNotificationMatrixDto, @Req() req: any) {
    const userId = req.user?.id || 0;
    return this.notificationsService.createMatrix(dto, userId);
  }

  @Put("matrix/:id")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "EDIT" })
  updateMatrix(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationMatrixDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 0;
    return this.notificationsService.updateMatrix(id, dto, userId);
  }

  @Delete("matrix/:id")
  @RequirePermissions({ module: "NOTIFICATIONS", action: "DEACTIVATE" })
  removeMatrix(@Param("id", ParseIntPipe) id: number) {
    return this.notificationsService.removeMatrix(id);
  }

  // =========================================================================
  // 4. LEGACY / DIRECT NOTIFICATION ENDPOINTS
  // =========================================================================

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.create(
      createNotificationDto,
      req.user?.id || 0,
    );
  }

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.notificationsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.update(
      id,
      updateNotificationDto,
      req.user?.id || 0,
    );
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.notificationsService.remove(id);
  }
}
