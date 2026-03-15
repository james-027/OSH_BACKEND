import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Action } from "../entities/Action";

import { CreateActionDto } from "../dto/CreateActionDto";
import { UpdateActionDto } from "../dto/UpdateActionDto";

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionsRepository: Repository<Action>
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const actions = await this.actionsRepository.find({
        relations: ["status"],
        order: {
          action_level: "ASC",
        },
      });

      return actions.map((action) => ({
        id: action.id,
        action_name: action.action_name,
        status_id: action.status_id,
        status_name: action.status ? action.status.status_name : null,
      }));
    } catch (error) {
      console.error("Error fetching actions:", error);
      throw new Error("Failed to fetch actions");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const action = await this.actionsRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!action) {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }

      return {
        id: action.id,
        action_name: action.action_name,
        status_id: action.status_id,
        status_name: action.status ? action.status.status_name : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching action:", error);
      throw new Error("Failed to fetch action");
    }
  }

  async create(createActionDto: CreateActionDto): Promise<any> {
    try {
      const newAction = this.actionsRepository.create({
        action_name: createActionDto.action_name,
        status_id: createActionDto.status_id || 1,
      });

      const savedAction = await this.actionsRepository.save(newAction);

      const actionWithRelations = await this.actionsRepository.findOne({
        where: { id: savedAction.id },
        relations: ["status"],
      });

      if (!actionWithRelations) {
        throw new Error("Failed to retrieve created action");
      }

      return {
        id: actionWithRelations.id,
        action_name: actionWithRelations.action_name,
        status_id: actionWithRelations.status_id,
        status_name: actionWithRelations.status
          ? actionWithRelations.status.status_name
          : null,
      };
    } catch (error) {
      console.error("Error creating action:", error);
      throw new Error("Failed to create action");
    }
  }

  async update(id: number, updateActionDto: UpdateActionDto): Promise<any> {
    try {
      const action = await this.actionsRepository.findOne({
        where: { id },
      });

      if (!action) {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }

      await this.actionsRepository.update(id, updateActionDto);

      const updatedAction = await this.actionsRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!updatedAction) {
        throw new Error("Failed to retrieve updated action");
      }

      return {
        id: updatedAction.id,
        action_name: updatedAction.action_name,
        status_id: updatedAction.status_id,
        status_name: updatedAction.status
          ? updatedAction.status.status_name
          : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error updating action:", error);
      throw new Error("Failed to update action");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const action = await this.actionsRepository.findOne({
        where: { id },
      });

      if (!action) {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }

      await this.actionsRepository.remove(action);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting action:", error);
      throw new Error("Failed to delete action");
    }
  }

  async toggleStatus(id: number): Promise<any> {
    try {
      const action = await this.actionsRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!action) {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }

      const newStatusId = action.status_id === 1 ? 2 : 1;

      await this.actionsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedAction = await this.actionsRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!updatedAction) {
        throw new Error("Failed to retrieve updated action");
      }

      return {
        id: updatedAction.id,
        action_name: updatedAction.action_name,
        status_id: updatedAction.status_id,
        status_name: updatedAction.status
          ? updatedAction.status.status_name
          : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error toggling action status:", error);
      throw new Error("Failed to toggle action status");
    }
  }
}
