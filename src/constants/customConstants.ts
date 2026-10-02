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
  TRANSFER: 11,
  DEPLOY: 12,
  BUDDY_UP: 13,
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
  REJECTED: 15,
  TRAINEE : 20,
  POSTED : 4,
  VALIDATED : 40,
  COMPUTED : 41,
} as const;

// ============= POS AVAILABIITY =============
export const POS_AVAILABILITY_IDS = {
  WITH_POS: 1,
  WITHOUT_POS: 2,
} as const;


// ============= WORKING DAY =============
export const WORKING_DAY_IDS = {
REGULAR_DAY : 1,
REGULAR_HOLIDAY : 2,
SPECIAL_HOLIDAY : 3,
REST_DAY_REGULAR_HOLIDAY : 4,
REST_DAY_SPECIAL_HOLIDAY : 5,
REGULAR_HOLIDAY_OFF :6,
REST_DAY: 7
} as const;
// ============= ACCESS KEY =============
export const ACCESS_KEY_IDS = {
  CTGI_ACCESS: 1,
  BOUNTY_PLUS_ACCESS: 2,
} as const;

// ============= LOGS TYPE  =============
export const LOGS_TYPE_ID = {
  POS_FETCH: 1,
  CC_FETCH: 2,
} as const;

export const ACCESS_PROCESS = {
    AUTO_ENROLL_SCHEDULE: [ACCESS_KEY_IDS.BOUNTY_PLUS_ACCESS] as number[],
};

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
  [STATUS_IDS.INACTIVE]: "Inactive",
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
  SPA_ADMIN: 0,
  SPA_NATIONWIDE_ADMIN: 3,
  SPA_OSA_ADMIN: 4,
  SPA_OSS_ADMIN: 7,
  SPA_BC_HEAD: 8,
  SPA_REGIONAL_HEAD: 10,
  SPA_GROUP_AREA_HEAD: 15,
  SPA_GROUP_BC_HEAD: 16,
} as const;

export const SALES_PLOTTING_PERSONNEL_NOTIFICATION_ROLE_IDS = [
  ROLE_IDS.SPA_ADMIN,
  ROLE_IDS.SPA_NATIONWIDE_ADMIN,
  ROLE_IDS.SPA_OSS_ADMIN,
  ROLE_IDS.SPA_OSA_ADMIN,
  ROLE_IDS.SPA_BC_HEAD,
  ROLE_IDS.SPA_REGIONAL_HEAD,
  ROLE_IDS.SPA_GROUP_AREA_HEAD,
  ROLE_IDS.SPA_GROUP_BC_HEAD,
] as const;

export const QA_PORT = "3002";

// ============= Days Factor Rate =============
export const DAYS_FACTOR_RATE = {
  DAYS: 26,
} as const;