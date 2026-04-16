import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
// import { StatusService } from "../services/status.service";
import { StatusService } from "../services/status.service";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { CreateStatusDto } from "src/modules/status/dto/CreateStatusDto";
import { UpdateStatusDto } from "src/modules/status/dto/UpdateStatusDto";

@Controller("statuses")
@UseGuards(JwtAuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  async findAll() {
    return this.statusService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.statusService.findOne(+id);
  }

  @Post()
  async create(@Body() createStatusDto: CreateStatusDto) {
    return this.statusService.create(createStatusDto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.statusService.update(+id, updateStatusDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.statusService.remove(+id);
  }
}
