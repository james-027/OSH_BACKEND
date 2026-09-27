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
import { WorkingDay } from "./WorkingDay";
import { PayrollHeader } from "./PayrollHeader";
import { ScheduleDetail } from "./ScheduleDetails";

@Entity("payroll_details")
export class PayrollDetails {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  payroll_header_id: number;

  @Column({ nullable: true })
  schedule_detail_id: number;

  @Column({ nullable: true })
  staff_id: number;

  @Column({ type: "varchar", length: 255 })
  staff_code: string;

  @Column({ nullable: true })
  vendor_id: number;

  @Column({ nullable: true })
  location_id: number;

  @Column({ nullable: true })
  warehouse_id: number;

  @Column({ type: "varchar", length: 255 })
  warehouse_ifs: string;

  @Column({ type: "timestamp", nullable: true })
  duty_start_time: Date;

  @Column({ type: "timestamp", nullable: true })
  duty_end_time: Date;

  @Column({ type: "timestamp", nullable: true })
  planned_duty_start_time: Date;

  @Column({ type: "timestamp", nullable: true })
  planned_duty_end_time: Date;

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

  @Column({ type: "timestamp", nullable: true })
  actual_time_in: Date;

  @Column({ type: "timestamp", nullable: true })
  actual_time_out: Date;

  @Column({ type: "timestamp", nullable: true })
  actual_break_in: Date;

  @Column({ type: "timestamp", nullable: true })
  actual_break_out: Date;

  @Column({ nullable: true })
  add_ot: number;

  @Column({ nullable: true })
  working_day_id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  attendance_status_id: number;

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

  @Column({ type: "text", nullable: true })
  payroll_remarks: string;

  @Column({ type: "time", nullable: true })
  regular_hours: string;

  @Column({ type: "time", nullable: true })
  overtime_hours: string;

  @Column({ type: "time", nullable: true })
  twh_hours: string;

  @Column({ type: "time", nullable: true })
  break_hours: string;

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

  @ManyToOne(() => WorkingDay, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "working_day_id" })
  workingDays: WorkingDay;

  @ManyToOne(() => ScheduleDetail, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "schedule_detail_id" })
  scheduleDetail: ScheduleDetail;

  @ManyToOne(() => PayrollHeader, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "payroll_header_id" })
  payrollHeader: PayrollHeader;


  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  regular_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  overtime_amount: number;
  
}
