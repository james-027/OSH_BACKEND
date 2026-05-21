import { DataSource } from "typeorm";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env file
// Make sure to specify the path to .env file
config({ path: resolve(__dirname, "../.env") });

// Import configuration after loading env vars
import { baseConfig, migrationConfig } from "./database/database.config";

// Debug: Log the loaded configuration (remove in production)
console.log("🔍 Database Config Debug:");
console.log("Host:", baseConfig.host);
console.log("Port:", baseConfig.port);
console.log("Username:", baseConfig.username);
console.log(
  "Password:",
  baseConfig.password ? "***LOADED***" : "❌ NOT LOADED",
);
console.log("Database:", baseConfig.database);

// Create and export the DataSource for TypeORM CLI
export const AppDataSource = new DataSource(migrationConfig);

// Initialize the data source (optional, useful for debugging)
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log(
        "✅ Data Source has been initialized successfully for migrations",
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error during Data Source initialization:", error);
      process.exit(1);
    });
}

AppDataSource.initialize().then((ds) => {
  console.log("=== ENTITIES LOADED ===");
  ds.entityMetadatas.forEach((e) => {
    console.log(e.name, "->", e.tableName);
  });
});