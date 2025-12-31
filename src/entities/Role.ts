import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { RoleActionPreset } from "./RoleActionPreset";
import { RoleLocationPreset } from "./RoleLocationPreset";
import { UserPermissions } from "./UserPermissions";
import { UserLocations } from "./UserLocations";
import { System } from "./System";

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  role_name!: string;

  @Column()
  role_level!: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roles, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ default: 1 })
  system_id!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  // Foreign key to User entity for created_by
  @ManyToOne(() => User, (user) => user.createdRoles, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number;

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoles, {
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

  // Relationship for role_id in RoleActionPreset
  @OneToMany(() => RoleActionPreset, (preset) => preset.role)
  roleActionPresets!: RoleActionPreset[];
  // Relationship for role_id in RoleLocationPreset
  @OneToMany(() => RoleLocationPreset, (preset) => preset.role)
  roleLocationPresets!: RoleLocationPreset[];

  // Relationship for role_id in User
  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  // Relationship for role_id in UserPermissions
  @OneToMany(() => UserPermissions, (userPermissions) => userPermissions.role)
  userPermissions!: UserPermissions[];

  // Relationship for role_id in UserLocations
  @OneToMany(() => UserLocations, (userLocations) => userLocations.role)
  userLocations!: UserLocations[];

  // Foreign key to User entity for updated_by
  @ManyToOne(() => System, (system) => system.roles, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "system_id" })
  system?: System;
}
