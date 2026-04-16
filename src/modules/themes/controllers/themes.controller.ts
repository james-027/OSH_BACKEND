import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { ThemesService } from "../services/themes.service";
import { CreateThemeDto } from "src/modules/themes/dto/CreateThemeDto";
import { UpdateThemeDto } from "src/modules/themes/dto/UpdateThemeDto";

@Controller("themes")
@UseGuards(JwtAuthGuard)
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  async findAll() {
    return this.themesService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.themesService.findOne(id);
  }

  @Post()
  async create(@Body() createThemeDto: CreateThemeDto, @Request() req) {
    const userId = req.user.id;
    return this.themesService.create(createThemeDto, userId);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateThemeDto: UpdateThemeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.themesService.update(id, updateThemeDto, userId);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.themesService.remove(id);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.themesService.toggleStatus(id, userId);
  }
}
