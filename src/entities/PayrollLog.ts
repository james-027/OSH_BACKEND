import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  Index,
  Unique,
} from "typeorm";
import { PayrollHeader } from "./PayrollHeader";
import { PayrollDetails } from "./PayrollDetails";

@Entity({ name: "payroll_logs" })
@Index(["payroll_header_id", "payroll_detail_id"])
@Unique(["payroll_detail_id"])
export class PayrollLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  payroll_header_id: number;

  @Column({ nullable: true })
  payroll_detail_id: number;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "text" })
  error_type: string;

  @Column({ type: "longtext", nullable: true })
  row_data: string;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @ManyToOne(() => PayrollHeader, {
    eager: false,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "payroll_header_id" })
  payrollHeader: PayrollHeader;

  @ManyToOne(() => PayrollDetails, {
    eager: false,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "payroll_detail_id" })
  payrollDetail: PayrollDetails;
}
