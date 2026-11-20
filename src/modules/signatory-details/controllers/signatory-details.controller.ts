import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { SignatoryDetailService } from "../services/signatory-details.service";
import { CreateSignatoryHeaderDto } from "../dto/CreateSignatoryDto";
import { UpdateSignatoryHeaderDto } from "../dto/UpdateSignatoryDto";

@Controller("signatory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SignatoryDetailController {
  constructor(
    private readonly signatoryDetailService: SignatoryDetailService,
  ) {}

  @Get()
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "VIEW" })
  async findAll(  @Request() req?: any,)
   {
    const accessKeyId = req?.user?.current_access_key;
    return this.signatoryDetailService.findAll(accessKeyId);
  }

  @Get("types")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "VIEW" })
  async findSignatoryType() {
    return this.signatoryDetailService.findSignatoryType();
  }

  @Get("signature-module/:moduleId")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "VIEW" })
  async findByModuleId(
    @Param("moduleId", ParseIntPipe) moduleId: number,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    return this.signatoryDetailService.findBySignatoreeByModule(moduleId, accessKeyId);
  }

  @Get("signature-details/:headerId")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "VIEW" })
  async findByScheduleDetails(
    @Param("headerId", ParseIntPipe) headerId: number,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    return this.signatoryDetailService.findSignatoryDetails(headerId);
  }

  @Post()
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "ADD" })
  async create(
    @Body() createDto: CreateSignatoryHeaderDto,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;

    return this.signatoryDetailService.create(createDto, userId, accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSignatoryHeaderDto,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;

    return this.signatoryDetailService.update(
      id,
      updateDto,
      accessKeyId,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.signatoryDetailService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.signatoryDetailService.toggleStatus(id, userId);
  }
}
