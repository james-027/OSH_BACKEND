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
import { Status } from "./Status";
import { Module } from "./Module";
import { EmailNotificationMatrixDetails } from "./EmailNotificationMatrixDetails";

@Entity({ name: "email_notification_matrix_recipients" })
export class EmailNotificationMatrixRecipients {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  line_id: number;

  @Column()
  userid: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string;

  // "isapprovalmatrix?" checkbox
  @Column({ type: "tinyint", default: 0 })
  is_approval_matrix: number;

  @Column({ nullable: true })
  module: number;

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
  @ManyToOne(
    () => EmailNotificationMatrixDetails,
    (line) => line.recipients,
  )
  @JoinColumn({ name: "line_id" })
  detail: EmailNotificationMatrixDetails;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userid" })
  userMaker: User;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => Module)
  @JoinColumn({ name: "module" })
  moduleData: Module;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;
}
