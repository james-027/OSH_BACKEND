import { Injectable } from "@nestjs/common";

@Injectable()
export class ResponseMapperService {
  /**
   * Maps an entity with createdBy, updatedBy, and status relations to a response object
   * @param entity - The entity object with potential relations
   * @returns Formatted response object with user names and status
   */
  mapEntityToResponse<T extends Record<string, any>>(entity: T): any {
    const response: any = {};

    // Copy all primitive fields
    for (const key in entity) {
      if (entity.hasOwnProperty(key) && typeof entity[key] !== "object") {
        response[key] = entity[key];
      } else if (key === "created_at" || key === "modified_at") {
        response[key] = entity[key];
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

    if (
      entity.renewalType &&
      typeof entity.renewalType === "object" &&
      (typeof entity.renewal_type_name === "undefined" ||
        typeof entity.renewal_type_name === "object")
    ) {
      response.renewal_type_name = entity.renewalType.renewal_type_name || null;
    } else if (typeof entity.renewal_type_name !== "object") {
      response.renewal_type_name = entity.renewal_type_name;
    } else {
      response.renewal_type_name = null;
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
