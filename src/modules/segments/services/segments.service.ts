import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Segment } from "src/entities/Segment";
import { UsersService } from "src/modules/users/services/users.service";
import { CreateSegmentDto } from "../dto/CreateSegmentDto";
import { UpdateSegmentDto } from "../dto/UpdateSegmentDto";

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment)
    private segmentsRepository: Repository<Segment>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const segments = await this.segmentsRepository.find({
      relations: ["status", "createdBy", "updatedBy", "brand"],
    });
    return segments.map((segment) => ({
      id: segment.id,
      segment_name: segment.segment_name,
      segment_abbr: segment.segment_abbr,
      status_id: segment.status_id,
      created_at: segment.created_at,
      created_by: segment.created_by,
      updated_by: segment.updated_by,
      modified_at: segment.modified_at,
      status_name: segment.status ? segment.status.status_name : null,
      created_user: segment.createdBy
        ? `${segment.createdBy.first_name} ${segment.createdBy.last_name}`
        : null,
      updated_user: segment.updatedBy
        ? `${segment.updatedBy.first_name} ${segment.updatedBy.last_name}`
        : null,
      brand_id: segment.brand_id,
      brand_name: segment.brand ? segment.brand.brand_name : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const segment = await this.segmentsRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy", "brand"],
    });
    if (!segment)
      throw new NotFoundException(`Segment with ID ${id} not found`);
    return {
      id: segment.id,
      segment_name: segment.segment_name,
      segment_abbr: segment.segment_abbr,
      status_id: segment.status_id,
      created_at: segment.created_at,
      created_by: segment.created_by,
      updated_by: segment.updated_by,
      modified_at: segment.modified_at,
      status_name: segment.status ? segment.status.status_name : null,
      created_user: segment.createdBy
        ? `${segment.createdBy.first_name} ${segment.createdBy.last_name}`
        : null,
      updated_user: segment.updatedBy
        ? `${segment.updatedBy.first_name} ${segment.updatedBy.last_name}`
        : null,
      brand_id: segment.brand_id,
      brand_name: segment.brand ? segment.brand.brand_name : null,
    };
  }

  async create(
    createSegmentDto: CreateSegmentDto,
    userId: number,
  ): Promise<any> {
    const existing = await this.segmentsRepository.findOne({
      where: { segment_name: createSegmentDto.segment_name },
    });
    if (existing)
      throw new BadRequestException("Segment with this name already exists");
    const newSegment = this.segmentsRepository.create({
      ...createSegmentDto,
      status_id: createSegmentDto.status_id || 1,
      created_by: userId,
      updated_by: userId,
    });
    const saved = await this.segmentsRepository.save(newSegment);
    return this.findOne(saved.id);
  }

  async update(
    id: number,
    updateDto: UpdateSegmentDto,
    userId: number,
  ): Promise<any> {
    const segment = await this.segmentsRepository.findOne({ where: { id } });
    if (!segment)
      throw new NotFoundException(`Segment with ID ${id} not found`);
    if (updateDto.segment_name) {
      const existing = await this.segmentsRepository.findOne({
        where: { segment_name: updateDto.segment_name },
      });
      if (existing && existing.id !== id)
        throw new BadRequestException("Segment with this name already exists");
    }
    await this.segmentsRepository.update(id, {
      ...updateDto,
      updated_by: userId,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const segment = await this.segmentsRepository.findOne({ where: { id } });
    if (!segment)
      throw new NotFoundException(`Segment with ID ${id} not found`);
    await this.segmentsRepository.remove(segment);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const segment = await this.segmentsRepository.findOne({ where: { id } });
    if (!segment) {
      throw new NotFoundException(`Segment with ID ${id} not found`);
    }
    const newStatusId = segment.status_id === 1 ? 2 : 1;
    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    await this.segmentsRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });
    return this.findOne(id);
  }
}
