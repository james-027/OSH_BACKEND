import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Warehouse } from "./Warehouse";
import { Employee } from "./Employee";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";

@Entity("warehouse_employees")
@Index("IDX_we_warehouse_id", ["warehouse_id"])
@Unique("UQ_assignment_emp_per_month", [
  "warehouse_id",
  "assigned_ss",
  "assigned_ah",
  "assigned_bch",
  "assigned_gbch",
  "assigned_rh",
  "assigned_grh",
  "assignment_date",
])
export class WarehouseEmployee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @Column()
  assigned_ss: number;

  @Column()
  assigned_ah: number;

  @Column({ nullable: true })
  assigned_bch: number;

  @Column({ nullable: true })
  assigned_gbch: number;

  @Column({ nullable: true })
  assigned_rh: number;

  @Column({ nullable: true })
  assigned_grh: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  access_key_id: number;

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

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: "date"})
  assignment_date: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: "warehouse_id" })
  warehouse: Warehouse;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_ss" })
  assignedSs: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_ah" })
  assignedAh: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_bch" })
  assignedBch: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_gbch" })
  assignedGbch: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_rh" })
  assignedRh: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "assigned_grh" })
  assignedGrh: Employee;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;
}
