import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ApiService } from "../modules/api/services/api.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => ApiService))
    private apiService: ApiService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawApiKey =
      request.headers["x-api-key"] ||
      request.headers["X-API-KEY"] ||
      request.body?.["X-API-KEY"] ||
      request.body?.["x-api-key"];

    if (!rawApiKey || typeof rawApiKey !== "string" || rawApiKey.trim() === "") {
      throw new HttpException("API key is required", HttpStatus.UNAUTHORIZED);
    }

    const apiKey = rawApiKey.trim();

    try {
      const key = await this.apiService.validateApiKey(apiKey);
      // Store the validated API key in request for later use
      request.apiKey = key;
      return true;
    } catch (error) {
      throw new HttpException("Invalid API key", HttpStatus.UNAUTHORIZED);
    }
  }
}
