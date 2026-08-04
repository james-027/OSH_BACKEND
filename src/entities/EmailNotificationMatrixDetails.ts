import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { Module } from "./Module";
import { EmailNotificationMatrix } from "./EmailNotificationMatrix";
import { EmailNotificationMatrixRecipients } from "./EmailNotificationMatrixRecipients";

@Entity({ name: "email_notification_matrix_details" })
export class EmailNotificationMatrixDetails {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  header_id: number;

  @Column()
  email_title: string;

  @Column({ nullable: true })
  module: number;

  // The document workflow event that triggers this email
  // (PENDING / APPROVED / RETURNED TO MAKER / POSTED)
  @Column({ nullable: true })
  trigger_status_id: number;

  // Email body template, e.g. "Document No: @document_number"
  @Column({ type: "text", nullable: true })
  email_format: string;

  @Column({
    type: "tinyint",
    default: 0,
  })
  is_approval_matrix: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;

  //Relationships
  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  // The trigger status (document event) for this notification
  @ManyToOne(() => Status)
  @JoinColumn({ name: "trigger_status_id" })
  triggerStatus: Status;

  @ManyToOne(() => Module)
  @JoinColumn({ name: "module", referencedColumnName: "id" })
  moduleData: Module;

  @ManyToOne(() => EmailNotificationMatrix, (header) => header.lines)
  @JoinColumn({ name: "header_id" })
  header: EmailNotificationMatrix;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  //Relationships
  @OneToMany(() => EmailNotificationMatrixRecipients, (item) => item.detail, {
    cascade: true,
  })
  recipients: EmailNotificationMatrixRecipients[];
}
