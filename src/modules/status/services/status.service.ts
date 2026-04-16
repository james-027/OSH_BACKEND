import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Status } from "../../../entities/Status";

import { CreateStatusDto } from "../dto/CreateStatusDto";
import { UpdateStatusDto } from "../dto/UpdateStatusDto";

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const statuses = await this.statusRepository.find();

      // Return flattened response similar to Express version
      return statuses.map((status) => ({
        id: status.id,
        status_name: status.status_name,
      }));
    } catch (error) {
      console.error("Error fetching statuses:", error);
      throw new Error("Failed to fetch statuses");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const status = await this.statusRepository.findOne({
        where: { id },
      });

      if (!status) {
        throw new NotFoundException(`Status with ID ${id} not found`);
      }

      // Return flattened response similar to Express version
      return {
        id: status.id,
        status_name: status.status_name,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching status:", error);
      throw new Error("Failed to fetch status");
    }
  }

  async create(createStatusDto: CreateStatusDto): Promise<any> {
    try {
      const newStatus = this.statusRepository.create({
        status_name: createStatusDto.status_name,
      });

      const savedStatus = await this.statusRepository.save(newStatus);

      // Return flattened response similar to Express version
      return {
        id: savedStatus.id,
        status_name: savedStatus.status_name,
      };
    } catch (error) {
      console.error("Error creating status:", error);
      throw new Error("Failed to create status");
    }
  }

  async update(id: number, updateStatusDto: UpdateStatusDto): Promise<any> {
    try {
      const status = await this.statusRepository.findOne({
        where: { id },
      });

      if (!status) {
        throw new NotFoundException(`Status with ID ${id} not found`);
      }

      // Update the status
      await this.statusRepository.update(id, updateStatusDto);

      // Fetch the updated status
      const updatedStatus = await this.statusRepository.findOne({
        where: { id },
      });

      if (!updatedStatus) {
        throw new Error("Failed to retrieve updated status");
      }

      // Return flattened response similar to Express version
      return {
        id: updatedStatus.id,
        status_name: updatedStatus.status_name,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error updating status:", error);
      throw new Error("Failed to update status");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const status = await this.statusRepository.findOne({
        where: { id },
      });

      if (!status) {
        throw new NotFoundException(`Status with ID ${id} not found`);
      }

      await this.statusRepository.remove(status);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting status:", error);
      throw new Error("Failed to delete status");
    }
  }
}
