import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Module } from "./Module";
import { Action } from "./Action";
import { Status } from "./Status";
import { User } from "./User";

@Entity("action_logs")
@Index("idx_action_logs_module_ref_created", ["module_id", "ref_id", "created_at"])
@Index("idx_action_logs_ref_created", ["ref_id", "created_at"])
export class ActionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  module_id: number;
  @ManyToOne(() => Module, { eager: true })
  @JoinColumn({ name: "module_id" })
  module: Module;

  @Column()
  ref_id: number;

  @Column()
  action_id: number;
  @ManyToOne(() => Action, { eager: true })
  @JoinColumn({ name: "action_id" })
  action: Action;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "json", nullable: true })
  raw_data: any;

  @Column({ default: 1 })
  status_id: number;
  @ManyToOne(() => Status, { eager: true })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @Column()
  created_by: number;
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @Column({ nullable: true })
  updated_by: number;
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;
}
