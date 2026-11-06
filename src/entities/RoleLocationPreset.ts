import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Role } from "./Role";
import { Location } from "./Location";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";

// Define a unique constraint on the combination of role_id, location_id, and access_key_id
@Unique("UQ_role_location_access", ["role_id", "location_id", "access_key_id"])
@Entity({ name: "role_location_preset" })
export class RoleLocationPreset {
  @PrimaryGeneratedColumn()
  id!: number;

  // Foreign key to Role entity
  @ManyToOne(() => Role, (role) => role.roleLocationPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column()
  role_id!: number;

  // Foreign key to Location entity
  @ManyToOne(() => Location, (location) => location.roleLocationPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "location_id" })
  location!: Location;

  @Column()
  location_id!: number;

  // Foreign key to AccessKey entity
  @ManyToOne(() => AccessKey, (accessKey) => accessKey.roleLocationPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @Column()
  access_key_id!: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roleLocationPresets, {
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
  @ManyToOne(() => User, (user) => user.createdRoleLocationPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number;

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoleLocationPresets, {
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
