import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { AccessKey } from "./AccessKey";
import { Status } from "./Status";
import { Location } from "./Location";
import { User } from "./User";
import { Item } from "./Item";
import { Warehouse } from "./Warehouse";

@Entity("sales_transactions")
@Index("idx_sales_transactions_item_code", ["item_code"])
@Index("idx_sales_transactions_whs_code", ["whs_code"])
@Index("idx_sales_transactions_bc_code", ["bc_code"])
@Index("idx_sales_transactions_cat01", ["cat01"])
@Index("idx_sales_transactions_cat02", ["cat02"])
@Index("idx_sales_transactions_sales_conv", ["sales_conv"])
@Index("idx_sales_transactions_sales_unit_eq", ["sales_unit_eq"])
export class SalesTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  doc_date: string;

  @Column()
  doc_date_month: number;

  @Column()
  bc_code: string;

  @Column()
  division: string;

  @Column()
  whs_code: string;

  @Column()
  whs_name: string;

  @Column()
  dchannel: string;

  @Column()
  item_code: string;

  @Column()
  item_desc: string;

  @Column()
  vat_cdoe: string;

  @Column("decimal", { precision: 18, scale: 6 })
  gross_sales: number;

  @Column("decimal", { precision: 18, scale: 6 })
  net_sales: number;

  @Column("decimal", { precision: 18, scale: 6 })
  quantity: number;

  @Column("decimal", { precision: 18, scale: 6 })
  converted_quantity: number;

  @Column("decimal", { precision: 18, scale: 6 })
  line_total: number;

  @Column("decimal", { precision: 18, scale: 6 })
  unit_price: number;

  @Column("decimal", { precision: 18, scale: 6 })
  vat_amount: number;

  @Column("decimal", { precision: 18, scale: 6 })
  line_cost: number;

  @Column("decimal", { precision: 18, scale: 6 })
  item_cost: number;

  @Column("decimal", { precision: 18, scale: 6 })
  disc_amount: number;

  @Column("decimal", { precision: 18, scale: 6 })
  vat_rate: number;

  @Column()
  cat01: string;

  @Column()
  cat02: string;

  @Column("decimal", { precision: 18, scale: 6 })
  sales_conv: number;

  @Column()
  sales_unit_eq: number;

  @Column()
  item_group: string;

  @Column()
  uom: string;

  @Column()
  access_key_id: number;

  @ManyToOne(() => AccessKey)
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @Column({ default: 1 })
  status_id: number;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

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

  @Column({ type: "text", nullable: true })
  cancel_reason?: string;

  @Column({ type: "text", nullable: true })
  undo_reason?: string;

  @Column({ nullable: true })
  location_id: number;

  @Column({ nullable: true })
  warehouse_id: number;

  @Column({ nullable: true })
  item_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

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

  @ManyToOne(() => Item, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "item_id" })
  item: Item;

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
