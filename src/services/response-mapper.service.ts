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
          "assignmentStatus",
          "category",
          "location",
          "vendor",
          "staff",
          "brand",
          "categoryType",
          "auditForm",
          "regionalHead",
          "groupBusinessCenterHead",
          "groupAreaHead",
          "areaHead",
          "auditBy",
          "warehouse",
          "position",
          "renewalType",
          "requirementType",
          "requirementReminders",
          "categoryTypes",
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

    // Map requirementType relation
    if (entity.requirementType && typeof entity.requirementType === "object") {
      response.requirement_type_name =
        entity.requirementType.requirement_type_name || null;
    }

    // Map category relation
    if (entity.category && typeof entity.category === "object") {
      response.category_name = entity.category.category_name || null;
    }

    // Map assignmentStatus relation
    if (
      entity.assignmentStatus &&
      typeof entity.assignmentStatus === "object"
    ) {
      response.assignment_status_name =
        entity.assignmentStatus.status_name || null;
    }

    // Map location relation
    if (entity.location && typeof entity.location === "object") {
      response.location_name = entity.location.location_name || null;
    }

    // Map warehouse relation
    if (entity.warehouse && typeof entity.warehouse === "object") {
      response.warehouse_name = entity.warehouse.warehouse_name || null;
    }

    // Map vendor relation
    if (entity.vendor && typeof entity.vendor === "object") {
      response.service_provider_name = entity.vendor.service_provider_name || null;
    }

    // Map staff relation
    if (entity.staff && typeof entity.staff === "object") {
      response.staff_name =
        entity.staff.first_name && entity.staff.last_name
          ? `${entity.staff.first_name} ${entity.staff.last_name}`
          : null;
    }

    // Map brand relation
    if (entity.brand && typeof entity.brand === "object") {
      response.brand_name = entity.brand.brand_name || null;
    }

    // Map categoryType relation
    if (entity.categoryType && typeof entity.categoryType === "object") {
      response.category_type_name =
        entity.categoryType.category_type_name || null;
    }

    // Map position relation
    if (entity.position && typeof entity.position === "object") {
      response.position_name = entity.position.position_name || null;
    }

    // Flatten categoryTypes if present
    if (entity.categoryTypes && Array.isArray(entity.categoryTypes)) {
      response.category_types = entity.categoryTypes.map((catType: any) => ({
        id: catType.id,
        category_type_name: catType.category_type_name,
        category_id: catType.category_id,
        status_id: catType.status_id,
        created_by: catType.created_by,
        updated_by: catType.updated_by,
        created_at: catType.created_at,
        modified_at: catType.modified_at,
        status_name: catType.status?.status_name || null,
      }));
    }

    //AUDIT FORM NAME RELATION
    if (entity.auditForm && typeof entity.auditForm === "object") {
    response.audit_form_name =
      entity.auditForm.audit_form_name || null;
  }

  //regionalHead  relation
    if (entity.regionalHead && typeof entity.regionalHead === "object") {
    response.regional_head_name =
      entity.regionalHead.employee_first_name && entity.regionalHead.employee_last_name
        ? `${entity.regionalHead.employee_first_name} ${entity.regionalHead.employee_last_name}`
        : null;
  }
  // AREA HEAD RELATION
    if (entity.areaHead && typeof entity.areaHead === "object") {
    response.area_head_name =
      entity.areaHead.employee_first_name && entity.areaHead.employee_last_name
        ? `${entity.areaHead.employee_first_name} ${entity.areaHead.employee_last_name}`
        : null;
  }

  // GROUP BUSINESS CENTER HEAD RELATION
      if (entity.groupBusinessCenterHead && typeof entity.groupBusinessCenterHead === "object") {
    response.group_business_center_head_name =
      entity.groupBusinessCenterHead.employee_first_name && entity.groupBusinessCenterHead.employee_last_name
        ? `${entity.groupBusinessCenterHead.employee_first_name} ${entity.groupBusinessCenterHead.employee_last_name}`
        : null;
  }
  
  //GROUP AREA HEAD
      if (entity.groupAreaHead && typeof entity.groupAreaHead === "object") {
    response.group_area_head_name =
      entity.groupAreaHead.employee_first_name && entity.groupAreaHead.employee_last_name
        ? `${entity.groupAreaHead.employee_first_name} ${entity.groupAreaHead.employee_last_name}`
        : null;
  }
  //AUDIT BY RELATION
      if (entity.auditBy && typeof entity.auditBy === "object") {
    response.audit_by_name =
      entity.auditBy.employee_first_name && entity.auditBy.employee_last_name
        ? `${entity.auditBy.employee_first_name} ${entity.auditBy.employee_last_name}`
        : null;
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
        }),
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
