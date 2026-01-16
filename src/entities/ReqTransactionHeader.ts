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
import { Requirement } from "./Requirement";
import { Warehouse } from "./Warehouse";
import { ReqTransactionDetail } from "./ReqTransactionDetail";
import { ReqTransactionDue } from "./ReqTransactionDue";
import { AccessKey } from "./AccessKey";
import { Location } from "./Location";

@Entity("req_transaction_headers")
export class ReqTransactionHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @Column()
  requirement_id: number;

  @Column({ type: "date" })
  trans_date: string;

  @Column({ type: "text", nullable: true })
  trans_remarks: string;

  @Column({ default: 1 })
  trans_due_status_id: number;

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

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ type: "varchar", length: 32, nullable: true })
  trans_number: string;

  @Column({ nullable: true })
  location_id: number;

  @ManyToOne(() => AccessKey, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "trans_due_status_id" })
  transDueStatus: Status;

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
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.reqTransactionHeaders, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse!: Warehouse;

  @ManyToOne(
    () => Requirement,
    (requirement) => requirement.reqTransactionHeaders,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "requirement_id" })
  requirement!: Requirement;

  @ManyToOne(() => Location, (location) => location.reqTransactionHeaders, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "location_id" })
  location!: Location;

  // Reference to entity relations
  @OneToMany(
    () => ReqTransactionDetail,
    (reqTransactionDetail) => reqTransactionDetail.reqTransactionHeader
  )
  reqTransactionDetails!: ReqTransactionDetail[];

  @OneToMany(
    () => ReqTransactionDue,
    (reqTransactionDue) => reqTransactionDue.reqTransactionHeader
  )
  reqTransactionDues!: ReqTransactionDue[];
}
