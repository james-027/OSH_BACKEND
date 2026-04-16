import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { databaseConfig } from "./database.config";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "mysql",
        host: configService.get<string>("DB_HOST") || "localhost",
        port: configService.get<number>("DB_PORT") || 3306,
        username: configService.get<string>("DB_USERNAME") || "root",
        password: configService.get<string>("DB_PASSWORD") || "",
        database: configService.get<string>("DB_DATABASE") || "xxx",
        entities: databaseConfig.entities,
        synchronize: false,
        // logging: configService.get<string>("NODE_ENV") === "development",
        logging: databaseConfig.logging,
        migrations: ["dist/migration/**/*.js"],
        migrationsTableName: "migrations",
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
