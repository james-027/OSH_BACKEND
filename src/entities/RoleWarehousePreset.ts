import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Role } from "./Role";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";
import { Warehouse } from "./Warehouse";

// Define a unique constraint on the combination of role_id, warehouse_id, and access_key_id
@Unique("UQ_role_warehouse_access", [
  "role_id",
  "warehouse_id",
  "access_key_id",
])
@Entity({ name: "role_warehouse_preset" })
export class RoleWarehousePreset {
  @PrimaryGeneratedColumn()
  id!: number;

  // Foreign key to Role entity
  @ManyToOne(() => Role, (role) => role.roleWarehousePresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column()
  role_id!: number;

  // Foreign key to Warehouse entity
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.roleWarehousePresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse!: Warehouse;

  @Column()
  warehouse_id!: number;

  // Foreign key to AccessKey entity
  @ManyToOne(() => AccessKey, (accessKey) => accessKey.roleWarehousePresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @Column({ default: 1 })
  access_key_id!: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roleWarehousePresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  // Foreign key to User entity for created_by
  @ManyToOne(() => User, (user) => user.createdRoleWarehousePresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number;

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoleWarehousePresets, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy?: User;

  @Column({ nullable: true })
  updated_by?: number;

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  modified_at!: Date;
}
