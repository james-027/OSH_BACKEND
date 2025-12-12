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
import { ReqTransactionHeader } from "./ReqTransactionHeader";
import { WarehouseRequirementDue } from "./WarehouseRequirementDue";

@Entity("req_transaction_dues")
export class ReqTransactionDue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  req_transaction_header_id: number;

  @Column()
  warehouse_requirement_due_id: number;

  @Column({ default: 1 })
  status_id: number;

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

  // Foreign keys
  @ManyToOne(
    () => ReqTransactionHeader,
    (transactionHeader) => transactionHeader.reqTransactionDues,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "req_transaction_header_id" })
  reqTransactionHeader!: ReqTransactionHeader;

  @ManyToOne(
    () => WarehouseRequirementDue,
    (warehouseRequirementDue) => warehouseRequirementDue.reqTransactionDues,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      cascade: true,
    }
  )
  @JoinColumn({ name: "warehouse_requirement_due_id" })
  warehouseRequirementDue!: WarehouseRequirementDue;
}
