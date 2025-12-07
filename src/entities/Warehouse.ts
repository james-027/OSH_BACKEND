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
import { WarehouseType } from "./WarehouseType";
import { Location } from "./Location";
import { Segment } from "./Segment";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";
import { WarehouseRequirement } from "./WarehouseRequirement";
import { ReqTransactionHeader } from "./ReqTransactionHeader";

@Entity("warehouses")
@Unique("UQ_warehouse_name_ifs_code", [
  "warehouse_name",
  "warehouse_ifs",
  "warehouse_code",
])
export class Warehouse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  warehouse_name: string;

  @Column({ length: 100 })
  warehouse_ifs: string;

  @Column({ length: 100 })
  warehouse_code: string;

  @Column()
  warehouse_type_id: number;

  @Column()
  location_id: number;

  @Column()
  segment_id: number;

  @Column({ length: 255 })
  address: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ default: 8 })
  rem_status_id: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  modified_at: Date;

  @ManyToOne(() => WarehouseType, { eager: false })
  @JoinColumn({ name: "warehouse_type_id" })
  warehouseType: WarehouseType;

  @ManyToOne(() => Location, { eager: false })
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => Segment, { eager: false })
  @JoinColumn({ name: "segment_id" })
  segment: Segment;

  @ManyToOne(() => Status, { eager: false })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "rem_status_id" })
  remStatus: Status;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @OneToMany(
    () => WarehouseRequirement,
    (warehouseRequirement) => warehouseRequirement.warehouse
  )
  warehouseRequirements!: WarehouseRequirement[];

  @OneToMany(
    () => ReqTransactionHeader,
    (reqTransactionHeader) => reqTransactionHeader.warehouse
  )
  reqTransactionHeaders!: ReqTransactionHeader[];
}
