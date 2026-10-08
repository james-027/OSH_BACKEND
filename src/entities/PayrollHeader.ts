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
import { AccessKey } from "./AccessKey";
import { PayrollDetails } from "./PayrollDetails";

@Entity("payroll_headers")
export class PayrollHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date", nullable: true })
  payroll_date_from: Date;

  @Column({ type: "date", nullable: true })
  payroll_date_to: Date;

  @Column({ length: 255 })
  reason: string;

  @Column({ length: 255 })
  remarks: string;

  @Column({ length: 255 })
  payroll_invoice: string;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ default: 1 })
  status_id: number;

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

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @OneToMany(() => PayrollDetails, (details) => details.payrollHeader)
  details: PayrollDetails[];

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_gross_pay: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_regular_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_special_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_regular_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_rest_day: number;
  
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_night_shift: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_day_work: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_regular_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_special_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_regular_holiday: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_rest_day: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_ot_day_work: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_regular_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_rest_day_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_night_shift_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_regular_holiday_off_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_rd_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_rd_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_regular_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_rest_day_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_rd_regular_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_ot_rd_special_holiday_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true, default: 0 })
  total_overtime_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_thirteen_month_pay: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_sss_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_pag_ibig_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_phil_health_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_govt_share: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_regular_day_amount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_payroll: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_asf: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_allowance: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_vat: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_with_vat: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_tax: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_net_of_tax: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_cash_bond: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  total_billing: number;

  @Column({ type: "boolean", default: false })
  cron_computed: boolean;

  @Column({ type: "boolean", default: false })
  is_reverted: boolean;
}