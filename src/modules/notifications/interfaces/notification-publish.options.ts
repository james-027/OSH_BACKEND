export interface NotificationNavigationOptions {
  route?: string;
  highlightIds?: number[];
  primaryId?: number | string;
  filterParams?: Record<string, unknown>;
  actionModal?: string;
}

export interface PublishNotificationOptions {
  moduleName: string;
  eventCode: string;
  refId: number;
  creatorId: number;
  accessKeyId?: number | null;
  locationIds?: number[];
  navigation?: NotificationNavigationOptions;
  payload?: Record<string, unknown>;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackActionUrl?: string;
}

