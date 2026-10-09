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

  @Column({
    type: "tinyint",
    nullable: true,
    comment:
      "Shift type: 1 = Night Shift, 2 = First Shift, 3 = Second Shift",
  })
  shift_type: number;

  @Column({
    type: "time",
    nullable: true,
    comment: "night_shift_hrs",
  })
  night_shift_hrs: string;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    comment: "night shift numeric value",
  })
  night_shift: number;

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

  @Column({ type: "date", nullable: true })
  schedule_date: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  night_shift_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  regular_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  rest_day_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  special_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  regular_holiday_off_amount: number;
  
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  regular_day_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  rd_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  rd_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_regular_amount: number;
  
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  net_amt_diser: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_rest_day_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_rd_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  ot_rd_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: 0 })
  overtime_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  salary_rate: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  hour_rate: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  gross_pay: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  regular_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  special_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  regular_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  rest_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_day_work: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  ot_regular_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  ot_special_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  ot_regular_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  ot_rest_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_day_work: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  thirteen_month_pay: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  sss_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  pag_ibig_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  phil_health_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_govt_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_payroll: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  asf: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_asf: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  allowance: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_allowance: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  vat: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_with_vat: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  tax: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  net_of_tax: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  cash_bond: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_billing: number;
}
