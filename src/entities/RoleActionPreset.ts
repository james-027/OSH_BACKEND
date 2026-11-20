import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Role } from "./Role";
import { Module } from "./Module";
import { Action } from "./Action";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";

// Define a unique constraint on the combination of role_id, module_id, action_id, and access_key_id
@Unique("UQ_role_module_action_access", [
  "role_id",
  "module_id",
  "action_id",
  "access_key_id",
])
@Entity({ name: "role_action_preset" })
export class RoleActionPreset {
  @PrimaryGeneratedColumn()
  id!: number;

  // Foreign key to Role entity
  @ManyToOne(() => Role, (role) => role.roleActionPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column()
  role_id!: number;

  // Foreign key to Module entity
  @ManyToOne(() => Module, (module) => module.roleActionPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "module_id" })
  module!: Module;

  @Column()
  module_id!: number;

  // Foreign key to Action entity
  @ManyToOne(() => Action, (action) => action.roleActionPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "action_id" })
  action!: Action;

  @Column()
  action_id!: number;

  // Foreign key to AccessKey entity
  @ManyToOne(() => AccessKey, (accessKey) => accessKey.roleActionPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @Column({ default: 1 })
  access_key_id!: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roleActionPresets, {
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
  @ManyToOne(() => User, (user) => user.createdRoleActionPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number;

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoleActionPresets, {
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
