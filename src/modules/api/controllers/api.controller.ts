import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiService } from "../services/api.service";
import { ApiKeyGuard } from "../../../guards/api-key.guard";

@Controller("api")
@UseGuards(ApiKeyGuard)
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get(":endpoint")
  async getData(
    @Param("endpoint") endpoint: string,
    @Query() queryParams: any,
    @Req() request: any,
  ) {
    try {
      return await this.apiService.handleGetRequest(
        endpoint,
        queryParams,
        request.apiKey,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(message, status);
    }
  }

  @Post(":endpoint")
  async createData(
    @Param("endpoint") endpoint: string,
    @Body() data: any,
    @Req() request: any,
  ) {
    try {
      return await this.apiService.handlePostRequest(
        endpoint,
        data,
        request.apiKey,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(message, status);
    }
  }

  @Put(":endpoint/:id")
  async updateData(
    @Param("endpoint") endpoint: string,
    @Param("id") id: number,
    @Body() data: any,
    @Req() request: any,
  ) {
    try {
      return await this.apiService.handlePutRequest(
        endpoint,
        id,
        data,
        request.apiKey,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(message, status);
    }
  }

  @Delete(":endpoint/:id")
  async deleteData(
    @Param("endpoint") endpoint: string,
    @Param("id") id: number,
    @Req() request: any,
  ) {
    try {
      return await this.apiService.handleDeleteRequest(
        endpoint,
        id,
        request.apiKey,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(message, status);
    }
  }
}
