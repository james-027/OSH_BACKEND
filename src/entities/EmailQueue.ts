import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Module } from "./Module";
import { Status } from "./Status";
@Entity("email_queue")
export class EmailQueue {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  document_number: string;

  @Column({ type: "bigint", nullable: false })
  transaction_id: number;

  @Column({ type: "int", nullable: false })
  module_id: number;

  @ManyToOne(() => Module, { nullable: true })
  @JoinColumn({ name: "module_id" })
  module: Module;

  @Column({ type: "int", nullable: false })
  trigger_status_id: number;

  @ManyToOne(() => Status, { nullable: true })
  @JoinColumn({ name: "trigger_status_id" })
  triggerStatus: Status;

  @Column({ type: "int", default: 1 })
  status_id: number; // 1 = Pending, 2 = Sent/Completed, 3 = Failed
  @ManyToOne(() => Status, { nullable: true })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @Column({ type: "int", default: 3 })
  priority: number;

  @Column({ type: "int", default: 0 })
  retry_count: number;

  @Column({ type: "int", default: 5 })
  max_retry: number;

  @Column({ type: "timestamp", nullable: true })
  next_retry_date: Date | null;

  @Column({ type: "timestamp", nullable: true })
  processing_date: Date | null;

  @Column({ type: "timestamp", nullable: true })
  finished_date: Date | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  worker_name: string | null;

  @Column({ type: "int", default: 0 })
  manual_execute: number;

  @Column({ type: "text", nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: "timestamp" })
  queued_date: Date;

  @Column({ type: "bigint", nullable: true })
  created_by: number;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "created_by" })
  creator: User;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @Column({
    type: "text",
    nullable: true,
  })
  recipient_to: string | null;

  @Column({
    type: "text",
    nullable: true,
  })
  recipient_cc: string | null;

  @Column({
    type: "varchar",
    length: 500,
    nullable: true,
  })
  email_subject: string | null;
}
