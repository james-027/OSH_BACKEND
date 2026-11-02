export class NotificationTriggerEvent {
  constructor(
    public readonly moduleName: string,
    public readonly eventCode: string,
    public readonly refId: number,
    public readonly creatorId: number,
    public readonly accessKeyId?: number | null,
    public readonly data?: Record<string, any>,
    public readonly customTitle?: string,
    public readonly customDescription?: string,
    public readonly actionUrl?: string,
  ) {}
}

