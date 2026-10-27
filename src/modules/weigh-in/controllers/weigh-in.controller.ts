import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from "@nestjs/common";
import {
  FileInterceptor,
  diskStorage,
} from "../../../adapters";
import {
  FILE_SIZE_LIMITS,
} from "src/utils/file-upload.utils";
import * as fs from "fs";
import * as path from "path";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { CreateWeighInDto } from "../dto/CreateWeighInDto";
import { UpdateWeighInDto } from "../dto/UpdateWeighInDto";
import { WeighInService } from "../services/weigh-in.service";
import { attachmentFileFilter } from "src/modules/debit-advice/controllers/attachment/file-filters";

@Controller("weigh-ins")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WeighInController {
  constructor(
    private readonly weighInService: WeighInService,
  ) {}

  @Get()
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
 @Get()
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
//   async findAll(@Request() req) {
//     const userId = req.user?.id;
//     const roleId = req.user?.role_id;
//     return this.weighInService.findAll(userId, roleId);
//   }

@Get()
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
  async findAll(@Request() req) {
    const userId = req.user?.id;    // Uses the ID from your JWT token / logged-in user
    const roleId = req.user?.role_id; // Uses the role ID from your JWT token
    return this.weighInService.findAll(userId, roleId);
  }

  @Get("pagination")
  async Getbypagination(
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 5,
    @Query("search") search = "",
    @Query("statusid") statusId = "",
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.weighInService.GetbysearchAndPages(
      Number(page),
      Number(pageSize),
      search,
      statusId,
      userId,
      roleId,
    );
  }
  
  @Post("bulk")
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
  async findBulk(@Body() body: { ids: number[] }, @Request() req) {
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      throw new BadRequestException("No weigh-in IDs provided.");
    }

    return this.weighInService.findBulk(body.ids);
  }

  @Get(":id")
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.weighInService.findOne(id);
  }

  @Get("history/:ref_id")
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "VIEW",
  })
  async findOneHistory(@Param("ref_id", ParseIntPipe) ref_id: number, @Request() req) {
    return this.weighInService.findOneHistory(ref_id);
  }

  @Post()
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "ADD",
  })
  async create(@Body() createWeighInDto: CreateWeighInDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    const controlNo = req.user?.control_no;
    const roleId = req.user?.role_id;
    return this.weighInService.create(createWeighInDto, userId, accessKeyId, controlNo, roleId);
  }

  @Put(":control_no")
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "EDIT",
  })
  async update(
    @Param("control_no") controlNo: string,
    @Body() updateWeighInDto: UpdateWeighInDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    return this.weighInService.update(controlNo, updateWeighInDto, userId, accessKeyId);
  }

  @Delete(":control_no")
  async delete(@Param("control_no") controlNo: string, @Request() req) {
    const userId = req.user.id;
    return this.weighInService.delete(controlNo, userId);
  }

  @Post(":control_no/upload-attachment")
  @RequirePermissions({
    module: ["WEIGH IN"],
    action: "ADD",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const controlNo = req.params.control_no;
          const uploadPath = path.join(
            process.cwd(),
            "uploads",
            "attachment",
            "weigh-ins",
            controlNo,
          );

          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, {
              recursive: true,
            });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
      fileFilter: attachmentFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadAttachment(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }

    const controlNo = req.params.control_no;
    const userId = req.user.id;

    return this.weighInService.saveAttachment(
      "WEIGH IN",
      0,
      controlNo,
      file,
      userId,
    );
  }

  @Get("attachment/:control_no/view")
  async viewAttachment(
    @Param("control_no") controlNo: string,
    @Request() req,
  ) {
    return await this.weighInService.findAttachment(controlNo);
  }

  @Delete("attachment/:id")
  async deleteAttachment(
    @Param("id") id: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    const result = await this.weighInService.deleteAttachment(id, userId);

    return {
      message: "Attachment deleted successfully",
      data: result,
    };
  }
}