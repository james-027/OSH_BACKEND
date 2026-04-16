import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EmployeeLocation } from "src/entities/EmployeeLocation";
import { CreateEmployeeLocationDto } from "../dto/CreateEmployeeLocationDto";
import { UpdateEmployeeLocationDto } from "../dto/UpdateEmployeeLocationDto";

@Injectable()
export class EmployeeLocationsService {
  constructor(
    @InjectRepository(EmployeeLocation)
    private readonly repo: Repository<EmployeeLocation>,
  ) {}

  async addLocation(dto: CreateEmployeeLocationDto) {
    // Only add if not exists (unique constraint)
    const exists = await this.repo.findOne({
      where: { employee_id: dto.employee_id, location_id: dto.location_id },
    });
    if (exists) {
      if (exists.status_id === 2) {
        exists.status_id = 1;
        return this.repo.save(exists);
      }
      throw new BadRequestException("Location already assigned to employee");
    }
    return this.repo.save({ ...dto, status_id: dto.status_id ?? 1 });
  }

  async toggleStatus(id: number, status_id: number) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException("EmployeeLocation not found");
    entry.status_id = status_id;
    return this.repo.save(entry);
  }

  async findByEmployee(employee_id: number) {
    return this.repo.find({
      where: { employee_id },
      relations: ["location", "status"],
    });
  }

  async findByLocation(location_id: number) {
    return this.repo.find({
      where: { location_id },
      relations: ["employee", "status"],
    });
  }

  async findOne(id: number) {
    return this.repo.findOne({
      where: { id },
      relations: ["employee", "location", "status"],
    });
  }
}
