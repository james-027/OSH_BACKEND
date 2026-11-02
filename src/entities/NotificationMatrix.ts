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
import { Module } from "./Module";
import { Status } from "./Status";
import { User } from "./User";
import { NotificationMatrixRecipient } from "./NotificationMatrixRecipient";

@Entity("notification_matrix")
export class NotificationMatrix {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  module_id: number;

  @ManyToOne(() => Module, { eager: true })
  @JoinColumn({ name: "module_id" })
  module: Module;

  @Column({ type: "varchar", length: 100 })
  event_code: string; // e.g., 'ATTENDANCE_REVERSAL_REQUEST'

  @Column({ type: "varchar", length: 255 })
  event_name: string; // e.g., 'Reversal of Computed Attendance'

  @Column({ type: "varchar", length: 255, nullable: true })
  title_template: string; // e.g., 'Attendance Reversal Requested - Schedule #{ref_id}'

  @Column({ type: "text", nullable: true })
  description_template: string; // e.g., '{user_name} requested attendance reversal for Schedule #{ref_id}. Remarks: {remarks}'

  @Column({ type: "varchar", length: 500, nullable: true })
  action_url: string; // e.g., '/staff-attendance'

  @Column({ default: 1 })
  status_id: number;

  @ManyToOne(() => Status, { eager: true })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @Column({ nullable: true })
  created_by: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @Column({ nullable: true })
  updated_by: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

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
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @OneToMany(() => NotificationMatrixRecipient, (rec) => rec.matrix, {
    cascade: true,
  })
  recipients: NotificationMatrixRecipient[];
}

