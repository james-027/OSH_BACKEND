import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class FrontendUrlUtil {
  private allowedUrls: string[];
  private defaultUrl: string;

  constructor(private configService: ConfigService) {
    // Parse CORS_ORIGIN as list of allowed frontend URLs
    const corsOrigin = this.configService.get<string>("CORS_ORIGIN", "");
    this.allowedUrls = (corsOrigin || "")
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u && u !== "*");

    // Set default fallback URL
    this.defaultUrl =
      this.configService.get<string>("FRONTEND_URL") ||
      this.allowedUrls[0] ||
      "http://localhost:5173";
  }

  /**
   * Get the correct frontend URL based on request origin
   * Falls back to default if origin is not recognized
   * @param requestOrigin - Origin from request headers
   * @returns Frontend URL to use
   */
  getFrontendUrl(requestOrigin?: string): string {
    if (requestOrigin && this.allowedUrls.includes(requestOrigin)) {
      return requestOrigin;
    }
    return this.defaultUrl;
  }

  /**
   * Extract origin from request headers
   * Falls back to constructing origin from hostname and protocol if header is missing
   * @param request - HTTP request object
   * @returns Origin URL or undefined
   */
  getOriginFromRequest(request: any): string | undefined {
    return request?.headers?.origin;
    // Try to get origin from header first
    // const originFromHeader = request?.headers?.origin;
    // if (originFromHeader) {
    //   return originFromHeader;
    // }

    // // Fallback: construct origin from hostname and protocol
    // const hostname = request?.hostname || request?.headers?.host;
    // const protocol = request?.protocol || "http";

    // if (hostname) {
    //   return `${protocol}://${hostname}`;
    // }

    // return undefined;
  }

  /**
   * Get frontend URL from request in one call
   * Convenience method that combines origin extraction and URL validation
   * @param request - HTTP request object
   * @returns Frontend URL to use for this request
   */
  getFrontendUrlFromRequest(request: any): string {
    const origin = this.getOriginFromRequest(request);
    // console.log("Origin:", origin);
    return this.getFrontendUrl(origin);
  }
}
