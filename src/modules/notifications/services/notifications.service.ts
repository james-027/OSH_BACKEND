import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification } from "src/entities/Notification";
import { CreateNotificationDto } from "../dto/CreateNotificationDto";
import { UpdateNotificationDto } from "../dto/UpdateNotificationDto";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
    created_by: number,
  ) {
    // Create notifications for each to_user_id
    const notifications = createNotificationDto.to_user_ids.map((to_user_id) =>
      this.notificationRepository.create({
        ...createNotificationDto,
        to_user_id,
        created_by,
        status_id: 1,
      }),
    );
    return this.notificationRepository.save(notifications);
  }

  async findAll() {
    return this.notificationRepository.find();
  }

  async findOne(id: number) {
    return this.notificationRepository.findOneBy({ id });
  }

  async update(
    id: number,
    updateNotificationDto: UpdateNotificationDto,
    updated_by: number,
  ) {
    await this.notificationRepository.update(id, {
      ...updateNotificationDto,
      updated_by,
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.notificationRepository.delete(id);
  }

  // Universal method for storing notifications for multiple users
  async notify(params: {
    module_id: number;
    ref_id: number;
    description: string;
    raw_data?: any;
    to_user_ids: number[];
    created_by: number;
  }) {
    const notifications = params.to_user_ids.map((to_user_id) =>
      this.notificationRepository.create({
        module_id: params.module_id,
        ref_id: params.ref_id,
        description: params.description,
        raw_data: params.raw_data,
        to_user_id,
        created_by: params.created_by,
        status_id: 1,
      }),
    );
    return this.notificationRepository.save(notifications);
  }
}
