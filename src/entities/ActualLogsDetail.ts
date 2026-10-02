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
import { ActualLogsHeader } from "./ActualLogsHeader";
import { Warehouse } from "./Warehouse";
import { Location } from "./Location";
import { Vendor } from "./Vendor";
import { AccessKey } from "./AccessKey";

@Entity("actual_log_details")
export class ActualLogsDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable:true})
  actual_header_id: number;

  @Column({nullable:true})
  staff_id: number;

  @Column({ length: 255 })
  staff_code: string;

  @Column({ length: 255 })
  remarks: string;

  @Column({nullable:true})
  warehouse_id: number;

  @Column({nullable:true})
  location_id: number;

  @Column({nullable:true})
  service_provider_id: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ type: "date", nullable: true })
  logs_date: Date;

  @Column({ type: "timestamp", nullable: true })
  time_in: Date;

  @Column({ type: "timestamp", nullable: true })
  time_out: Date;

  @Column({ type: "timestamp", nullable: true })
  break_out: Date;

  @Column({ type: "timestamp", nullable: true })
  break_in: Date;

  @Column({ type: "timestamp", nullable: true })
  overtime_in: Date;

  @Column({ type: "timestamp", nullable: true })
  overtime_out: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  working_hours: number;

  @Column({ type: "timestamp", nullable: true })
  orig_time_in: Date;

  @Column({ type: "timestamp", nullable: true })
  orig_time_out: Date;

  @Column({ type: "timestamp", nullable: true })
  orig_break_in: Date;

  @Column({ type: "timestamp", nullable: true })
  orig_break_out: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  regular: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  overtime: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  twh: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  break_hours: number;
  
  @Column({
    type: "tinyint",
    nullable: true,
    comment:
      "Shift type: 1 = Night Shift, 2 = First Shift, 3 = Second Shift",
  })
  shift_type: number;
  
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

  @ManyToOne(() => Vendor, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "service_provider_id" })
  vendor: Vendor;

  @ManyToOne(() => Location, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => Warehouse, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse: Warehouse;

  @ManyToOne(() => ActualLogsHeader, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "actual_header_id" })
  actualHeader: ActualLogsHeader;

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
}
