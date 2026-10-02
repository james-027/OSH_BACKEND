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
import { ScheduleDetail } from "./ScheduleDetails";

@Entity("payroll_invoices")
export class PayrollInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  payroll_invoice: string;

  @Column({ nullable: true })
  schedule_detail_id: number;
  
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  regular: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  overtime: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  twh: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  break_hours: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

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

  @ManyToOne(() => ScheduleDetail, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "schedule_detail_id" })
  scheduleDetail: ScheduleDetail;

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

}
