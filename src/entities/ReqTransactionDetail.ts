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

@Entity("req_transaction_details")
export class ReqTransactionDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  req_transaction_header_id: number;

  @Column({ type: "text" })
  requirement_file_path: string;

  @Column({ type: "text" })
  requirement_file_name: string;

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
    (transactionHeader) => transactionHeader.reqTransactionDetails,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "req_transaction_header_id" })
  reqTransactionHeader!: ReqTransactionHeader;
}
