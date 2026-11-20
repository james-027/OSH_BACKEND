import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { CrewHubService } from "../services/crew-hub.service";
import { CreateCrewHubSystemDto } from "../dto/create-crew-hub-system.dto";
import { UpdateCrewHubSystemDto } from "../dto/update-crew-hub-system.dto";
import { CreateLearningMaterialDto } from "../dto/create-learning-material.dto";
import { UpdateLearningMaterialDto } from "../dto/update-learning-material.dto";
import {
  QueryCrewHubMaterialDto,
  QueryCrewHubSystemDto,
} from "../dto/query-crew-hub.dto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { RedisOnlyInterceptor } from "src/interceptors/redis-only.interceptor";
import { CacheKey, CacheTTL } from "src/decorators/cache.decorator";
import { CACHE_KEYS, CACHE_TTL } from "src/config/cache.config";
import { FileInterceptor, diskStorage } from "src/adapters";
import { generateTimestampFilename } from "src/utils/file-upload.utils";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("crew-hub")
export class CrewHubController {
  constructor(private readonly crewHubService: CrewHubService) {}

  // ==============================================================
  // PUBLIC ROUTES (No Login Required - Optimized with Redis Cache)
  // For Store Crew System Hub Landing Page & Video Viewer
  // ==============================================================

  /**
   * Aggregated overview: systems + materials + material types
   * Recommended for landing page initial render (single network request)
   */
  @Get("overview")
  @UseInterceptors(RedisOnlyInterceptor)
  @CacheKey(CACHE_KEYS.CREW_HUB_OVERVIEW)
  @CacheTTL(CACHE_TTL.GENERAL_FIND_ALL)
  async getOverview() {
    return this.crewHubService.getOverview();
  }

  /**
   * List all active system launcher cards
   */
  @Get("systems")
  @UseInterceptors(RedisOnlyInterceptor)
  @CacheKey(CACHE_KEYS.CREW_HUB_SYSTEMS)
  @CacheTTL(CACHE_TTL.GENERAL_FIND_ALL)
  async getPublicSystems() {
    return this.crewHubService.getPublicSystems();
  }

  /**
   * List all active and currently valid learning materials / videos
   */
  @Get("learning-materials")
  @UseInterceptors(RedisOnlyInterceptor)
  @CacheKey(CACHE_KEYS.CREW_HUB_MATERIALS)
  @CacheTTL(CACHE_TTL.GENERAL_FIND_ALL)
  async getPublicMaterials(@Query() query: QueryCrewHubMaterialDto) {
    return this.crewHubService.getPublicMaterials(query);
  }

  /**
   * List active learning material types (Video, Document, etc.)
   */
  @Get("learning-material-types")
  @UseInterceptors(RedisOnlyInterceptor)
  @CacheKey(CACHE_KEYS.CREW_HUB_TYPES)
  @CacheTTL(CACHE_TTL.GENERAL_FIND_ALL)
  async getMaterialTypes() {
    return this.crewHubService.getMaterialTypes();
  }

  // ==============================================================
  // ADMIN ROUTES (Protected with JWT - Admin / Content Management)
  // ==============================================================

  // --- Systems Management ---

  @Get("admin/systems")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "DATA ACCESS" })
  async getAdminSystems(@Query() query: QueryCrewHubSystemDto) {
    return this.crewHubService.getAdminSystems(query);
  }

  @Get("admin/systems/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "DATA ACCESS" })
  async getAdminSystemById(@Param("id", ParseIntPipe) id: number) {
    return this.crewHubService.getSystemById(id);
  }

  @Post("admin/systems")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "ADD" })
  async createSystem(@Body() dto: CreateCrewHubSystemDto, @Request() req: any) {
    const userId = req.user?.id;
    return this.crewHubService.createSystem(dto, userId);
  }

  @Put("admin/systems/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "EDIT" })
  async updateSystem(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrewHubSystemDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.updateSystem(id, dto, userId);
  }

  @Patch("admin/systems/:id/toggle-status")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "EDIT" })
  async toggleSystemStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.toggleSystemStatus(id, userId);
  }

  @Delete("admin/systems/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "DELETE" })
  async removeSystem(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.removeSystem(id, userId);
  }

  // --- Learning Materials Management ---

  @Get("admin/learning-materials")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  async getAdminMaterials(@Query() query: QueryCrewHubMaterialDto) {
    return this.crewHubService.getAdminMaterials(query);
  }

  @Get("admin/learning-materials/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  async getAdminMaterialById(@Param("id", ParseIntPipe) id: number) {
    return this.crewHubService.getMaterialById(id);
  }

  @Post("admin/learning-materials")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "ADD" })
  async createMaterial(
    @Body() dto: CreateLearningMaterialDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.createMaterial(dto, userId);
  }

  @Put("admin/learning-materials/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "EDIT" })
  async updateMaterial(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLearningMaterialDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.updateMaterial(id, dto, userId);
  }

  @Patch("admin/learning-materials/:id/toggle-status")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "DEACTIVATE" })
  async toggleMaterialStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.toggleMaterialStatus(id, userId);
  }

  @Delete("admin/learning-materials/:id")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "DELETE" })
  async removeMaterial(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.crewHubService.removeMaterial(id, userId);
  }

  // --- Upload Files (Icons, Documents, Videos) ---
  @Post("admin/upload")
  @UseGuards(PermissionsGuard)
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ module: "CREW HUB", action: "ADD" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/crew-hub",
        filename: generateTimestampFilename,
      }),
      limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file format");
    }
    const relativeUrl = `/uploads/crew-hub/${file.filename}`;
    return {
      url: relativeUrl,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
