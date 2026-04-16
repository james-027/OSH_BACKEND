import * as mysql from "mysql2/promise";

/**
 * Centralized DWH Datasource Configuration
 * Manages connection pools for all external data warehouse sources
 * DRY principle: Single source of truth for all DWH connections
 */

// ==================== CONNECTION CONFIGS ====================

export const DWH_CONFIG = {
  CTGI_BOS: {
    host: "10.2.4.122",
    user: "akatok",
    password: "nF+G5-M%",
    database: "ctgi",
  },
  CTGI_SEMS: {
    host: "192.168.74.121",
    user: "ctgi_cms_rem_usr",
    password: "B@v1CM$r3m0t3Localdba@C3sS",
    database: "ctgi_sems",
  },
  CTGI_EBT: {
    host: "192.168.74.214",
    user: "dba_remote",
    password: "Wdwaxwdadz#07",
    database: "ctgi",
  },
  CTGI_BUDGETING: {
    host: "192.168.74.41",
    user: "bud_remote",
    password: "B@v1-r3mot3-dba@cct",
  },
};

// ==================== CONNECTION POOLS ====================

/**
 * CTGI DWH Pool - Sales transactions and general DWH queries
 * Used by: SalesTransactionsDwhService, SalesBudgetTransactionsDwhService
 */
export const CTGI_BOS_POOL = mysql.createPool({
  ...DWH_CONFIG.CTGI_BOS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * CTGI SEMS Pool - Warehouse/Outlets data
 * Used by: WarehouseDwhService
 */
export const CTGI_SEMS_POOL = mysql.createPool({
  ...DWH_CONFIG.CTGI_SEMS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * CTGI Items Pool - Items and categories data
 * Used by: ItemsDwhService
 */
export const CTGI_EBT_POOL = mysql.createPool({
  ...DWH_CONFIG.CTGI_EBT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * CTGI Budgeting Pool - Sales budget transactions (dynamic database selection)
 * Used by: SalesBudgetTransactionsDwhService
 * Note: Database name is dynamically specified at runtime
 */
export const CTGI_BUDGETING_POOL = mysql.createPool({
  ...DWH_CONFIG.CTGI_BUDGETING,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ==================== POOL GETTER FUNCTIONS ====================

/**
 * Get connection from CTGI DWH pool
 * Automatically returns connection from pool
 */
export async function getCtgiBosDwhConnection() {
  return CTGI_BOS_POOL.getConnection();
}

/**
 * Get connection from CTGI SEMS pool
 * Automatically returns connection from pool
 */
export async function getCtgiSemsConnection() {
  return CTGI_SEMS_POOL.getConnection();
}

/**
 * Get connection from CTGI Items pool
 * Automatically returns connection from pool
 */
export async function getCtgiItemsConnection() {
  return CTGI_EBT_POOL.getConnection();
}

/**
 * Get connection from CTGI Budgeting pool
 * Automatically returns connection from pool
 * Database can be changed after getting connection via: connection.changeUser({ database: newDb })
 */
export async function getCtgiBudgetingConnection(database?: string) {
  const conn = await CTGI_BUDGETING_POOL.getConnection();
  if (database) {
    await conn.changeUser({ database });
  }
  return conn;
}

// ==================== POOL CLEANUP ====================

/**
 * Close all pools gracefully (call on app shutdown)
 */
export async function closeAllDwhPools() {
  try {
    await CTGI_BOS_POOL.end();
    await CTGI_SEMS_POOL.end();
    await CTGI_EBT_POOL.end();
    await CTGI_BUDGETING_POOL.end();
  } catch (err) {
    console.error("Error closing DWH pools:", err);
  }
}
