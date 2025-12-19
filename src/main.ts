// Load environment variables FIRST before any imports
import * as dotenv from "dotenv";
dotenv.config();

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, LogLevel } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import logger from "./config/logger";
import { join } from "path";

// Platform selection via environment variable
const USE_FASTIFY = process.env.USE_FASTIFY === "true";

async function bootstrap() {
  let app: any;
  const configService = new ConfigService();

  // Determine log levels based on environment
  const isDevelopment = process.env.NODE_ENV !== "production";
  const logLevels: LogLevel[] = isDevelopment
    ? ["error", "warn", "debug"]
    : ["error", "warn"];

  if (USE_FASTIFY) {
    // Fastify setup with payload limits
    const { FastifyAdapter } = await import("@nestjs/platform-fastify");
    const fastifyInstance = new FastifyAdapter({
      bodyLimit: 800 * 1024 * 1024, // 800MB (slightly above max batch to avoid HTTP layer rejection)
    });
    app = await NestFactory.create(AppModule, fastifyInstance, {
      logger: logLevels,
    });
    logger.info("⚡ Running with Fastify adapter");
    await setupFastify(app, configService);
  } else {
    // Express setup with payload limits BEFORE app creation
    const expressApp = require("express")();

    // Set payload limits FIRST before any middleware (800MB to allow Guard to enforce limits)
    expressApp.use(json({ limit: "800mb", strict: true }));
    expressApp.use(
      urlencoded({ limit: "800mb", extended: true, parameterLimit: 50 })
    );

    // Now create the NestJS app
    app = await NestFactory.create(AppModule, expressApp, {
      logger: logLevels,
    });
    logger.info("🚀 Running with Express adapter");
    await setupExpress(app, configService);
  }

  // Common setup for both platforms
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  const port = configService.get<number>("port") || 3000;
  const host = USE_FASTIFY ? "0.0.0.0" : undefined;

  await app.listen(port, host);

  logger.info(`🚀 NestJS Application is running on: http://localhost:${port}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🔌 Platform: ${USE_FASTIFY ? "Fastify" : "Express"}`);
}

// Express-specific setup
async function setupExpress(app: any, configService: ConfigService) {
  const cors = require("cors");
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : ["*"];

  logger.info("🌍 CORS Origins configured:", corsOrigins);

  // Enable CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (corsOrigins.includes("*") || corsOrigins.includes(origin)) {
          logger.info(`✅ CORS: Allowing origin: ${origin}`);
          return callback(null, true);
        }
        logger.error(`❌ CORS: Rejecting origin: ${origin}`);
        return callback(
          new Error(`CORS policy violation: Origin ${origin} not allowed`),
          false
        );
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-csrf-token",
        "X-CSRF-Token",
        "X-Requested-With",
        "Accept",
        "Accept-Version",
        "Accept-Language",
        "Accept-Encoding",
        "Content-Length",
        "Content-MD5",
        "Cache-Control",
        "cache-control",
        "Pragma",
        "pragma",
        "Date",
        "If-Modified-Since",
        "If-None-Match",
        "Range",
        "User-Agent",
      ],
      credentials: true,
      maxAge: 86400,
    })
  );

  // ===== SECURITY CONFIGURATIONS =====

  // 1. Set request timeout to prevent slowloris attacks
  // EXCEPT for SSE endpoints which need persistent connections
  app.use((req, res, next) => {
    // SSE endpoints need NO timeout (or very long timeout)
    if (req.path && req.path.startsWith('/sse/')) {
      req.setTimeout(0); // No timeout for SSE
      res.setTimeout(0);
    } else {
      req.setTimeout(30000); // 30 seconds for normal requests
      res.setTimeout(30000);
    }
    next();
  });

  // 2. Add security headers (basic, without helmet library)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    next();
  });

  // Serve static files
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/",
  });
}

// Fastify-specific setup
async function setupFastify(app: any, configService: ConfigService) {
  const fastifyCors = await import("@fastify/cors");
  const fastifyMultipart = await import("@fastify/multipart");
  const fastifyStatic = await import("@fastify/static");

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : ["*"];

  logger.info("🌍 CORS Origins configured:", corsOrigins);

  // Register CORS
  await app.register(fastifyCors.default, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        logger.info(`✅ CORS: Allowing origin: ${origin}`);
        return callback(null, true);
      }
      logger.error(`❌ CORS: Rejecting origin: ${origin}`);
      return callback(
        new Error(`CORS policy violation: Origin ${origin} not allowed`),
        false
      );
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-csrf-token",
      "X-CSRF-Token",
      "X-Requested-With",
      "Accept",
      "Accept-Version",
      "Accept-Language",
      "Accept-Encoding",
      "Content-Length",
      "Content-MD5",
      "Cache-Control",
      "cache-control",
      "Pragma",
      "pragma",
      "Date",
      "If-Modified-Since",
      "If-None-Match",
      "Range",
      "User-Agent",
    ],
    credentials: true,
    maxAge: 86400,
  });

  // Register multipart support with increased limits for batch uploads
  await app.register(fastifyMultipart.default, {
    limits: {
      fileSize: 150 * 1024 * 1024, // 150MB for batch file uploads
    },
  });

  // Serve static files
  await app.register(fastifyStatic.default, {
    root: join(__dirname, "..", "uploads"),
    prefix: "/uploads/",
  });
}

bootstrap().catch((error) => {
  logger.error("❌ Error starting the application:", error);
  process.exit(1);
});
