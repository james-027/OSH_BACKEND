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
<<<<<<< HEAD
    Query,
=======
>>>>>>> 77d5e91 (Additonal Debit Advice Uploading and additonal data fetching by ID)
} from "@nestjs/common";
import {
    FileInterceptor,
    diskStorage,
    UploadedFile as FileType,
} from "../../../adapters";
import {
    excelFileFilter,
    FILE_SIZE_LIMITS,
    generateTimestampFilename,
} from "src/utils/file-upload.utils";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { DebitAdviceService } from "../services/debit-advice.service";
import { CreateDebitAdviceDto } from "../dto/CreateDebitAdviceDto";
import { UpdateDebitAdviceDto } from "../dto/UpdateDebitAdviceDto";

@Controller("debit-advices")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceController {
    constructor(private readonly debitAdviceService: DebitAdviceService) { }
    @Get()
    // @RequirePermissions({ module: "DEBIT_ADVICES", action: "VIEW" })
    async findAll(@Request() req) {
        return this.debitAdviceService.findAll();
    }

    @Get("pagination")
    async Getbypagination(
        @Query("page") page = 1,
        @Query("pageSize") pageSize = 5,
        @Query("search") search = "",
        @Query("statusid") statusId = "",
    ) {
        return this.debitAdviceService.GetbysearchAndPages(
            Number(page),
            Number(pageSize),
            search,
            statusId,
        );
    }


    @Get('test')
    test() {
        console.log('✅ DebitAdviceController hit');
        return 'working';
    }
    @Get(":id")
    @RequirePermissions({
        module: ["DEBIT ADVICE", "FINANCE CONFIRMATION"],
        action: "VIEW"
    })
    async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
        return this.debitAdviceService.findOne(id);
    }


    @Get("history/:ref_id")
    @RequirePermissions({
        module: ["DEBIT ADVICE", "FINANCE CONFIRMATION"],
        action: "VIEW"
    })
    async findOneHistory(@Param("ref_id", ParseIntPipe) ref_id: number, @Request() req) {
        return this.debitAdviceService.findOneHistory(ref_id);
    }

    @Post()
    @RequirePermissions({
        module: ["DEBIT ADVICE", "FINANCE CONFIRMATION"],
        action: "ADD"
    })
    // @RequirePermissions({ module: "DEBIT ADVICE", action: "ADD" })
    async create(@Body() createDebitAdviceDto: CreateDebitAdviceDto, @Request() req) {
        const userId = req.user.id;
        const accessKeyId = req.user?.current_access_key;
        const docno = req.user?.document_number;
        return this.debitAdviceService.create(createDebitAdviceDto, userId, accessKeyId, docno);
    }


    @Put(":docno")
    @RequirePermissions({
        module: ["DEBIT ADVICE", "FINANCE CONFIRMATION"],
        action: "EDIT"
    })
    // @RequirePermissions({ module: "DEBIT ADVICE", action: "EDIT" })
    async update(
        @Param("docno") docno: string,
        @Body() updateDebitAdviceDto: UpdateDebitAdviceDto,
        @Request() req,
    ) {
        const userId = req.user.id;
        const accessKeyId = req.user?.current_access_key;
        return this.debitAdviceService.update(docno, updateDebitAdviceDto, userId, accessKeyId,);
    }

    @Delete(":docno")
    // @RequirePermissions({ module: "DEBIT ADVICE", action: "DELETE" })
    async delete(@Param("docno") docno: string, @Request() req) {
        const userId = req.user.id;
        return this.debitAdviceService.delete(docno, userId);
    }

    @Post("upload-excel")
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "./uploads/debit-advice-upload",
                filename: generateTimestampFilename,
            }),
            fileFilter: excelFileFilter,
            limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB }, // 8MB
        }),
    )
    @RequirePermissions({ module: "DEBIT ADVICE", action: "ADD" })
    async uploadExcelDebitAdvices(@UploadedFile() file: FileType, @Request() req) {
        if (!file)
            throw new BadRequestException("No file uploaded or invalid file type.");

        const userId = req.user.id;
        const roleId = req.user.role_id;
        const accessKeyId = req.user.current_access_key;
        const result = await this.debitAdviceService.uploadExcelDebitAdvices(
            file.path,
            userId,
            roleId,
            accessKeyId,
        );
        return result;
    }
}