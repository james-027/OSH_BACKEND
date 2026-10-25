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
  Res,
} from "@nestjs/common";
import { ApiService } from "../services/api.service";
import { ApiKeyGuard } from "../../../guards/api-key.guard";
import { PhpShieldGuard } from "../../../guards/php-shield.guard";

@Controller("api")
@UseGuards(PhpShieldGuard, ApiKeyGuard)
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
      if (error instanceof HttpException) {
        throw error;
      }
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

  @Get(":prefix/:endpoint")
  async getDataNested(
    @Param("prefix") prefix: string,
    @Param("endpoint") endpoint: string,
    @Query() queryParams: any,
    @Req() request: any,
  ) {
    return this.getData(`${prefix}/${endpoint}`, queryParams, request);
  }

  @Post(":endpoint")
  async createData(
    @Param("endpoint") endpoint: string,
    @Body() data: any,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    try {
      const result = await this.apiService.handlePostRequest(
        endpoint,
        data,
        request.apiKey,
      );

      // Transparent passthrough for relayed legacy PHP responses (exact status & exact body)
      if (
        result &&
        typeof result === "object" &&
        result.__isRelayResponse
      ) {
        if (typeof response.status === "function") {
          response.status(result.statusCode);
        } else if (typeof response.code === "function") {
          response.code(result.statusCode);
        }
        return result.data;
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
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

  @Post(":prefix/:endpoint")
  async createDataNested(
    @Param("prefix") prefix: string,
    @Param("endpoint") endpoint: string,
    @Body() data: any,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.createData(`${prefix}/${endpoint}`, data, request, response);
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
      if (error instanceof HttpException) {
        throw error;
      }
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
      if (error instanceof HttpException) {
        throw error;
      }
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
