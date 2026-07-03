/**
 * Custom application constants
 * Centralized repository for hardcoded values used across services
 */

// ============= MODULE IDs =============
export const MODULE_IDS = {
  STORE_HURDLES: 16,
  LOCATION_HURDLES: 31,
  STORE_EMPLOYEES: 14,
  STAFFS: 40,
} as const;

export const NAMING_CONVENTION = {
  WAREHOUSE: "Store",
} as const;
// ============= ACTION IDs =============
export const ACTION_IDS = {
  ADD: 1,
  EDIT: 2,
  CANCEL: 3,
  POST: 4,
  ACTIVATE: 5,
  DEACTIVATE: 6,
  APPROVE: 7,
  REVERT: 10,
  TRANSFER:11,
  DEPLOY:12,
  BUDDY_UP:13,
} as const;

// ============= STATUS IDs =============
export const STATUS_IDS = {
  ACTIVE: 1,
  INACTIVE: 2,
  PENDING: 3,
  CANCELLED: 5,
  FOR_APPROVAL: 6,
  APPROVED: 7,
  TERMINATED: 18,
  WITH_ASSIGNMENT: 21,
  TEMPORARY_ASSIGNMENT: 26,
} as const;

export const STATUS_NAMES = {
  [STATUS_IDS.PENDING]: "Pending",
  [STATUS_IDS.FOR_APPROVAL]: "For Approval",
  [STATUS_IDS.APPROVED]: "Approved",
  [STATUS_IDS.ACTIVE]: "Active",
  [STATUS_IDS.INACTIVE]: "Inactive",
  [STATUS_IDS.TERMINATED]: "Terminated",
  [STATUS_IDS.CANCELLED]: "Cancelled",
} as const;

export const TOGGLE_NAMES = {
  [STATUS_IDS.PENDING]: "Back to Pending", // Toggle action name
  [STATUS_IDS.FOR_APPROVAL]: "For Approval",
  [STATUS_IDS.APPROVED]: "Approved",
} as const;

// ============= WAREHOUSE REM STATUS =============
export const WAREHOUSE_REM_STATUS_IDS = {
  NEEDS_REQUIREMENTS: [8, 9], // Warehouses that need requirement sync
} as const;

// ============= RENEWAL TYPE IDs =============
export const RENEWAL_TYPE_IDS = {
  ONE_TIME: 1,
} as const;

export const ROLE_IDS = {
  SPA_NATIONWIDE_ADMIN: 3,
  SPA_ADMIN: 4,
  SPA_OSS_ADMIN: 0,
  SPA_OSA_ADMIN: 0,
} as const;

export const SALES_PLOTTING_PERSONNEL_NOTIFICATION_ROLE_IDS = [
  ROLE_IDS.SPA_ADMIN,
  ROLE_IDS.SPA_NATIONWIDE_ADMIN,
  ROLE_IDS.SPA_OSS_ADMIN,
  ROLE_IDS.SPA_OSA_ADMIN,
] as const;
