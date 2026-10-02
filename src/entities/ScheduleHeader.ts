import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { ScheduleDetail } from "./ScheduleDetails";
import { AccessKey } from "./AccessKey";

@Entity("schedule_headers")
export class ScheduleHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date", nullable: true })
  schedule_date: Date;

  @Column()
  entry_no: number;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ nullable: true })
  attendance_status_id: number;

  @Column({ nullable: true })
  attendance_updated_by: number;

  @Column({ type: "text", nullable: true })
  attendance_reason: string;

  @Column({ nullable: true })
  payroll_updated_by: number;

  @Column({
    type: "timestamp",
    nullable: true,
  })
  attendance_ts: Date;

  @Column({
    type: "timestamp",
    nullable: true,
  })
  payroll_ts: Date;

  @Column({ nullable: true })
  shifting_day: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "attendance_status_id" })
  attendanceStatus: Status;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "created_by" })
  createdBy: User;
  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "attendance_updated_by" })
  attendanceUpdated: User;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "payroll_updated_by" })
  payrollUpdated: User;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @OneToMany(() => ScheduleDetail, (detail) => detail.scheduleHeader, {
    cascade: true,
  })
  details: ScheduleDetail[];
}
