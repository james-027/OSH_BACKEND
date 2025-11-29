import { Injectable } from "@nestjs/common";

@Injectable()
export class ResponseMapperService {
  /**
   * Maps an entity with createdBy, updatedBy, and status relations to a response object
   * @param entity - The entity object with potential relations
   * @returns Formatted response object with user names and status
   */
  mapEntityToResponse<T extends Record<string, any>>(entity: T): any {
    if (!entity) return null;

    const response: any = {};

    // Copy all primitive fields and exclude relations
    for (const key in entity) {
      if (
        entity.hasOwnProperty(key) &&
        ![
          "createdBy",
          "updatedBy",
          "status",
          "renewalType",
          "requirementReminders",
        ].includes(key)
      ) {
        if (typeof entity[key] !== "object" || entity[key] === null) {
          response[key] = entity[key];
        } else if (key === "created_at" || key === "modified_at") {
          response[key] = entity[key];
        }
      }
    }

    // Map createdBy relation
    if (entity.createdBy && typeof entity.createdBy === "object") {
      response.created_user =
        entity.createdBy.first_name && entity.createdBy.last_name
          ? `${entity.createdBy.first_name} ${entity.createdBy.last_name}`
          : null;
    } else {
      response.created_user = null;
    }

    // Map updatedBy relation
    if (entity.updatedBy && typeof entity.updatedBy === "object") {
      response.updated_user =
        entity.updatedBy.first_name && entity.updatedBy.last_name
          ? `${entity.updatedBy.first_name} ${entity.updatedBy.last_name}`
          : null;
    } else {
      response.updated_user = null;
    }

    // Map status relation
    if (entity.status && typeof entity.status === "object") {
      response.status_name = entity.status.status_name || null;
    } else {
      response.status_name = null;
    }

    // Map renewalType relation
    if (entity.renewalType && typeof entity.renewalType === "object") {
      response.renewal_type_name = entity.renewalType.renewal_type_name || null;
    }

    // Flatten requirementReminders if present
    if (
      entity.requirementReminders &&
      Array.isArray(entity.requirementReminders)
    ) {
      response.requirement_reminders = entity.requirementReminders.map(
        (reminder: any) => ({
          id: reminder.id,
          requirement_id: reminder.requirement_id,
          reminder_type_id: reminder.reminder_type_id,
          reminder_count_day: reminder.reminder_count_day,
          status_id: reminder.status_id,
          created_by: reminder.created_by,
          updated_by: reminder.updated_by,
          created_at: reminder.created_at,
          modified_at: reminder.modified_at,
          reminder_type_name: reminder.reminderType?.reminder_type_name || null,
          reminder_status_name: reminder.status?.status_name || null,
        })
      );
    }

    return response;
  }

  /**
   * Maps an array of entities to response objects
   * @param entities - Array of entity objects
   * @returns Array of formatted response objects
   */
  mapEntitiesToResponse<T extends Record<string, any>>(entities: T[]): any[] {
    return entities.map((entity) => this.mapEntityToResponse(entity));
  }
}
