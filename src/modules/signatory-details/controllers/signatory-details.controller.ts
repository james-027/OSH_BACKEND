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
import { CreateSignatoryDetailDto } from "../dto/CreateSignatoryDto";
import { UpdateSignatoryDetailDto } from "../dto/UpdateSignatoryDto";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../../../adapters";
import {
  imageFileFilter,
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "../../../utils/file-upload.utils";

@Controller("signatory-details")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SignatoryDetailController {
  constructor(private readonly signatoryDetailService: SignatoryDetailService) {}

  @Get()
  @RequirePermissions({ module: "SIGNATORY MANAGEMENT", action: "VIEW" })
  async findAll() {
    return this.signatoryDetailService.findAll();
  }

}
