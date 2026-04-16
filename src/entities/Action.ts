import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Status } from "./Status";
import { RoleActionPreset } from "./RoleActionPreset";
import { UserPermissions } from "./UserPermissions";

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  action_name!: string;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.actions, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column()
  action_level!: number;

  // Relationship for action_id in RoleActionPreset
  @OneToMany(() => RoleActionPreset, (preset) => preset.action)
  roleActionPresets!: RoleActionPreset[];

  // Relationship for action_id in UserPermissions
  @OneToMany(() => UserPermissions, (userPermissions) => userPermissions.action)
  userPermissions!: UserPermissions[];
}
