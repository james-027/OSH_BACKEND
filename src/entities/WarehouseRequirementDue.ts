import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { WarehouseRequirement } from "./WarehouseRequirement";
import { ReqTransactionDue } from "./ReqTransactionDue";

@Entity("warehouse_requirement_dues")
@Unique("UQ_wh_req_id_req_dues", [
  "warehouse_requirement_id",
  "warehouse_requirement_due_start",
  "warehouse_requirement_due_end",
])
export class WarehouseRequirementDue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_requirement_id: number;

  @Column({ type: "date" })
  warehouse_requirement_due_start: string;

  @Column({ type: "date" })
  warehouse_requirement_due_end: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: "date", nullable: true })
  warehouse_requirement_due_pre_reminder_date: string;

  @Column({ type: "date", nullable: true })
  warehouse_requirement_due_post_reminder_date: string;

  @Column({ type: "date", nullable: true })
  warehouse_requirement_due_date: string;

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

  // Foreign key to requirement entity
  @ManyToOne(
    () => WarehouseRequirement,
    (warehouseRequirement) => warehouseRequirement.warehouseRequirementDues,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "warehouse_requirement_id" })
  warehouseRequirement!: WarehouseRequirement;

  @OneToMany(
    () => ReqTransactionDue,
    (reqTransactionDue) => reqTransactionDue.warehouseRequirementDue
  )
  reqTransactionDues!: ReqTransactionDue[];
}
