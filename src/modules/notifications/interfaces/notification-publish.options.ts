export interface NotificationSourceContext {
  module: string;                         // e.g. "STAFF ATTENDANCE"
  refId: number;                          // Primary entity ID of originating document (e.g. Schedule Header #33)
  referenceNo?: string;                   // Optional code or invoice (e.g. "SCH-2026-001")
  status?: { from: string; to: string };  // e.g. { from: "Computed", to: "Validated" }
  remarks?: string;                       // Remarks entered by the user
  extra?: Record<string, unknown>;        // Optional domain-specific properties
}

export interface NotificationDestinationContext {
  module: string;                         // e.g. "STAFF PAYROLL"
  route: string;                          // Target React route, e.g. "/staff-payroll"
  refIds: number[];                       // Target entity IDs -> Auto-mapped to highlight_ids in React state
  referenceNo?: string;                   // Target reference no (e.g. invoice string)
  statusId?: number;                      // Target filter status -> Auto-mapped to filter_params.status_id
  filterParams?: Record<string, unknown>; // Optional search/filter parameters for table preset
  actionModal?: string;                   // Optional modal to open automatically (e.g. "REVERT_MODAL")
}

export interface PublishNotificationOptions {
  eventCode: string;                      // e.g. "ATTENDANCE_REVERSAL_REQUEST" or "PAYROLL_REVERSAL_GRANT"
  creatorId: number;                      // Acting user ID
  accessKeyId?: number | null;            // Tenant access key ID
  locationIds?: number[];                 // Multi-branch filtering IDs
  
  // Streamlined Source & Destination contexts
  source: NotificationSourceContext;
  destination: NotificationDestinationContext;

  // Optional code-level fallbacks (used only if no matrix rule template was configured in DB)
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackActionUrl?: string;

  // Backwards-compatible legacy fields
  moduleName?: string;
  refId?: number;
  navigation?: any;
  payload?: Record<string, unknown>;
}
