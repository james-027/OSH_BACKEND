import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./User";
import { Role } from "./Role";
import { Status } from "./Status";
import { AccessKey } from "./AccessKey";
import { Vendor } from "./Vendor";

@Entity({ name: "user_vendors" })
@Unique("UQ_user_role_vendor_access", [
  "user_id",
  "role_id",
  "vendor_id",
  "access_key_id",
])
@Index("IDX_user_vendors_lookup", [
  "user_id",
  "role_id",
  "access_key_id",
  "status_id",
])
export class UserVendors {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  role_id!: number;

  @Column()
  vendor_id!: number;

  @Column({ default: 1 })
  access_key_id!: number;

  @Column({ default: 1 })
  status_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @Column()
  created_by!: number;

  @Column({ nullable: true })
  updated_by!: number | null;

  @UpdateDateColumn()
  modified_at!: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.userVendors, { eager: false })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Role, (role) => role.userVendors, { eager: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Vendor, (vendor) => vendor.userVendors, {
    eager: false,
  })
  @JoinColumn({ name: "vendor_id" })
  vendor!: Vendor;

  @ManyToOne(() => AccessKey, (accessKey) => accessKey.userVendors, {
    eager: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @ManyToOne(() => Status, (status) => status.userVendors, { eager: false })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @ManyToOne(() => User, (user) => user.createdUserVendors, {
    eager: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @ManyToOne(() => User, (user) => user.updatedUserVendors, {
    eager: false,
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User;
}
