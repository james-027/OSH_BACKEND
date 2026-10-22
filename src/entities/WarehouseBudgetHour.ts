import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Warehouse } from "./Warehouse";
import { Status } from "./Status";
import { User } from "./User";
import { Vendor } from "./Vendor";

@Entity("warehouse_budget_hours")
export class WarehouseBudgetHour {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: "warehouse_id" })
  warehouse: Warehouse;

  @Column({ type: "date" })
  budget_date_from: string;

  @Column({ type: "date" })
  budget_date_to: string;

  @Column("decimal", { precision: 10, scale: 2 })
  budget_hours: number;

  @Column()
  status_id: number;

  @Column({ nullable: true })
  vendor_id: number;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @Column()
  created_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;

  @Column()
  updated_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => Vendor, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "vendor_id" })
  vendor: Vendor;
}
