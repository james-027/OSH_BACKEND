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
  Index,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { Requirement } from "./Requirement";
import { Warehouse } from "./Warehouse";
import { WarehouseRequirementDue } from "./WarehouseRequirementDue";
import { WarehouseRequirementStart } from "./WarehouseRequirementStart";
import { AccessKey } from "./AccessKey";
import { Supplier } from "./Supplier";

@Entity("warehouse_requirements")
@Index("IDX_wr_warehouse_id", ["warehouse_id"])
@Unique("UQ_id_wh_id_requirement_id_status_id", [
  "id",
  "warehouse_id",
  "requirement_id",
  "status_id",
])
export class WarehouseRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @Column()
  requirement_id: number;

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

  @Column({ nullable: true })
  supplier_id: number;

  @Column("decimal", { precision: 14, scale: 2, nullable: true })
  contract_amount: number;

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
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.warehouseRequirements, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse!: Warehouse;

  @ManyToOne(
    () => Requirement,
    (requirement) => requirement.warehouseRequirements,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  )
  @JoinColumn({ name: "requirement_id" })
  requirement!: Requirement;

  @OneToMany(
    () => WarehouseRequirementDue,
    (warehouseRequirementDue) => warehouseRequirementDue.warehouseRequirement,
  )
  warehouseRequirementDues!: WarehouseRequirementDue[];

  @OneToMany(
    () => WarehouseRequirementStart,
    (warehouseRequirementStart) =>
      warehouseRequirementStart.warehouseRequirement,
  )
  warehouseRequirementStarts!: WarehouseRequirementStart[];

  @ManyToOne(() => Supplier, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "supplier_id" })
  supplier: Supplier;
}
