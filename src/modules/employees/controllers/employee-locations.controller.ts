import { Controller, Post, Put, Get, Param, Body, Query } from "@nestjs/common";
import { EmployeeLocationsService } from "../services/employee-locations.service";
import { CreateEmployeeLocationDto } from "../dto/CreateEmployeeLocationDto";

@Controller("employee-locations")
export class EmployeeLocationsController {
  constructor(private readonly service: EmployeeLocationsService) {}

  @Post()
  addLocation(@Body() dto: CreateEmployeeLocationDto) {
    return this.service.addLocation(dto);
  }

  @Put(":id/toggle-status")
  toggleStatus(@Param("id") id: number, @Body("status_id") status_id: number) {
    return this.service.toggleStatus(id, status_id);
  }

  @Get("by-employee/:employee_id")
  findByEmployee(@Param("employee_id") employee_id: number) {
    return this.service.findByEmployee(employee_id);
  }

  @Get("by-location/:location_id")
  findByLocation(@Param("location_id") location_id: number) {
    return this.service.findByLocation(location_id);
  }

  @Get(":id")
  findOne(@Param("id") id: number) {
    return this.service.findOne(id);
  }
}
