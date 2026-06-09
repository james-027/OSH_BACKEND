/**
 * Custom application constants
 * Centralized repository for hardcoded values used across services
 */

// ============= MODULE IDs =============
export const MODULE_IDS = {
  STORE_HURDLES: 16,
  LOCATION_HURDLES: 31,
  STORE_EMPLOYEES: 14,
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
} as const;

// ============= STATUS IDs (Store Hurdles) =============
export const STATUS_IDS = {
  ACTIVE: 1,
  INACTIVE: 2,
  PENDING: 3,
  CANCELLED: 5,
  FOR_APPROVAL: 6,
  APPROVED: 7,
  TERMINATED: 18,
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
