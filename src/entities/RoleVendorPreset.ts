import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { Role } from "./Role";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";
import { Vendor } from "./Vendor";

// Define a unique constraint on the combination of role_id, vendor_id, and access_key_id
@Unique("UQ_role_vendor_access", ["role_id", "vendor_id", "access_key_id"])
@Index("IDX_role_vendor_preset_lookup", [
  "role_id",
  "access_key_id",
  "status_id",
])
@Entity({ name: "role_vendor_preset" })
export class RoleVendorPreset {
  @PrimaryGeneratedColumn()
  id!: number;

  // Foreign key to Role entity
  @ManyToOne(() => Role, (role) => role.roleVendorPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column()
  role_id!: number;

  // Foreign key to Vendor entity
  @ManyToOne(() => Vendor, (vendor) => vendor.roleVendorPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "vendor_id" })
  vendor!: Vendor;

  @Column()
  vendor_id!: number;

  // Foreign key to AccessKey entity
  @ManyToOne(() => AccessKey, (accessKey) => accessKey.roleVendorPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @Column({ default: 1 })
  access_key_id!: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roleVendorPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  // Foreign key to User entity for created_by
  @ManyToOne(() => User, (user) => user.createdRoleVendorPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number;

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoleVendorPresets, {
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
