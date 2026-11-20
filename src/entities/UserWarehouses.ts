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
import { Warehouse } from "./Warehouse";

@Entity({ name: "user_warehouses" })
@Unique("UQ_user_role_warehouse_access", [
  "user_id",
  "role_id",
  "warehouse_id",
  "access_key_id",
])
@Index("IDX_user_warehouses_lookup", [
  "user_id",
  "role_id",
  "access_key_id",
  "status_id",
])
export class UserWarehouses {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  role_id!: number;

  @Column()
  warehouse_id!: number;

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
  @ManyToOne(() => User, (user) => user.userWarehouses, { eager: false })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Role, (role) => role.userWarehouses, { eager: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.userWarehouses, {
    eager: false,
  })
  @JoinColumn({ name: "warehouse_id" })
  warehouse!: Warehouse;

  @ManyToOne(() => AccessKey, (accessKey) => accessKey.userWarehouses, {
    eager: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @ManyToOne(() => Status, (status) => status.userWarehouses, { eager: false })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @ManyToOne(() => User, (user) => user.createdUserWarehouses, {
    eager: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @ManyToOne(() => User, (user) => user.updatedUserWarehouses, {
    eager: false,
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User;
}
