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
} from "@nestjs/common";
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
}