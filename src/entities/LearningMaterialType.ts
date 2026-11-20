import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { LearningMaterial } from "./LearningMaterial";

@Entity("learning_material_types")
export class LearningMaterialType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  type_name: string;

  @Column({ length: 50, nullable: true })
  type_code: string;

  @Column({ default: 1 })
  status: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  modified_at: Date;

  @OneToMany(() => LearningMaterial, (material) => material.type)
  materials: LearningMaterial[];
}

