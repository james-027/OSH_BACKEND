import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { LearningMaterialType } from "./LearningMaterialType";

@Entity("learning_materials")
export class LearningMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  learning_material_type_id: number;

  @Column({ length: 255 })
  learning_material_name: string;

  @Column({ type: "text", nullable: true })
  learning_material_description: string;

  @Column({ length: 500 })
  learning_material_url: string;

  @Column({ default: 1 })
  learning_material_status: number;

  @Column({ type: "date", nullable: true })
  learning_material_start_date: string | null;

  @Column({ type: "date", nullable: true })
  learning_material_end_date: string | null;

  @Column({ default: 0 })
  order_seq: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  modified_at: Date;

  @ManyToOne(() => LearningMaterialType, (type) => type.materials, {
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: "learning_material_type_id" })
  type: LearningMaterialType;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;
}

