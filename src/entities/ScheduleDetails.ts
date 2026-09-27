import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { Staff } from "./Staff";
import { Warehouse } from "./Warehouse";
import { Location } from "./Location";
import { Vendor } from "./Vendor";
import { ScheduleHeader } from "./ScheduleHeader";
import { WorkingDay } from "./WorkingDay";
import { ActualLogsDetail } from "./ActualLogsDetail";

@Entity("schedule_details")
export class ScheduleDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  staff_id: number;

  @Column({ nullable: true })
  schedule_header_id: number;

  @Column({ nullable: true })
  actual_logs_detail_id: number;

  @Column({ type: "varchar", length: 255 })
  staff_code: string;

  @Column({ nullable: true })
  vendor_id: number;

  @Column({ nullable: true })
  location_id: number;

  @Column({ nullable: true })
  warehouse_id: number;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column({ type: "text", nullable: true })
  system_remarks: string;

  @Column({ type: "timestamp", nullable: true })
  duty_start_time: Date;

  @Column({ type: "timestamp", nullable: true })
  duty_end_time: Date;

  @Column({ type: "timestamp", nullable: true })
  planned_duty_start_time: Date;

  @Column({ type: "timestamp", nullable: true })
  planned_duty_end_time: Date;

  @Column({ type: "timestamp", nullable: true })
  operational_start_time: Date;

  @Column({ type: "timestamp", nullable: true })
  operational_end_time: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  diff_outlet: string;

  @Column({ type: "timestamp", nullable: true })
  just_time_in: Date;
  
  @Column({ type: "timestamp", nullable: true })
  overtime_in: Date;
  
  @Column({ type: "timestamp", nullable: true })
  overtime_out: Date;

  @Column({ type: "timestamp", nullable: true })
  just_time_out: Date;

  @Column({ type: "timestamp", nullable: true })
  just_break_out: Date;

  @Column({ type: "timestamp", nullable: true })
  just_break_in: Date;

  @Column({ nullable: true })
  add_ot: number;

  @Column({ nullable: true })
  working_day_id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ type: "time", nullable: true })
  regular_hours: string;

  @Column({ type: "time", nullable: true })
  overtime_hours: string;

  @Column({ type: "time", nullable: true })
  twh_hours: string;

  @Column({ type: "time", nullable: true })
  break_hours: string;

  @Column({ nullable: true })
  attendance_status_id: number;

  @Column({ type: 'boolean', default: false })
  cron_computed: boolean;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: "text", nullable: true })
  just_remarks: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  regular: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  overtime: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  twh: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  break: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  payroll_invoice: number;

  @Column({ type: "text", nullable: true })
  payroll_remarks: string;

  @Column({
    type: "tinyint",
    nullable: true,
    comment: "flag for night shift",
  })
  is_night_shift: number;

  @Column({
    type: "time",
    nullable: true,
    comment: "night_shift_hrs",
  })
  is_night_shift_hrs: string;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    comment: "night shift numeric value",
  })
  night_shift: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  salary_rate: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  service_fee: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  allowance: number;

  @Column({
    type: "tinyint",
    nullable: true,
    default: 0,
    comment: "multiple duty flag",
  })
  multiple_duty: number;

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
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => Staff, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "staff_id" })
  staff: Staff;

  @ManyToOne(() => ActualLogsDetail, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "actual_logs_detail_id" })
  actualLogsDetail: ActualLogsDetail;

  @ManyToOne(() => Warehouse, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse: Warehouse;

  @ManyToOne(() => Location, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => Vendor, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "vendor_id" })
  vendor: Vendor;

  @ManyToOne(() => ScheduleHeader, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "schedule_header_id" })
  scheduleHeader: ScheduleHeader;

  @ManyToOne(() => WorkingDay, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "working_day_id" })
  workingDays: WorkingDay;
}
