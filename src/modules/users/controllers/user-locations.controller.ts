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
import { UserLocationsService } from "../services/user-locations.service";
import { CreateUserLocationsDto } from "src/modules/users/dto/CreateUserLocationsDto";
import { UpdateUserLocationsDto } from "src/modules/users/dto/UpdateUserLocationsDto";

@Controller("user-locations")
@UseGuards(JwtAuthGuard)
export class UserLocationsController {
  constructor(private readonly userLocationsService: UserLocationsService) {}

  @Get()
  async findAll() {
    return this.userLocationsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userLocationsService.findOne(id);
  }

  @Post()
  async create(
    @Body() createUserLocationsDto: CreateUserLocationsDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.userLocationsService.create(createUserLocationsDto, userId);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserLocationsDto: UpdateUserLocationsDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.userLocationsService.update(id, updateUserLocationsDto, userId);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.userLocationsService.remove(id);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.userLocationsService.toggleStatus(id, userId);
  }
}
