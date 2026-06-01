import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { Status } from "./Status";

@Entity("profitcenters")
export class Profitcenter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "profitcenter_code",
    length: 100,
    unique: true,
  })
  profitcenter_code: string;

  @Column({
    name: "profitcenter_name",
    length: 255,
  })
  profitcenter_name: string;

  @Column({
    name: "old_code",
    length: 100,
    nullable: true,
  })
  old_code: string;

  // Foreign key to Status entity
  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;
}