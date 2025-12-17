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

// Define a unique constraint on the combination of role_id and location_id
@Unique(["role_id", "location_id"])
@Entity()
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
  role_id!: number; // Explicitly define the foreign key column

  // Foreign key to Location entity
  @ManyToOne(() => Location, (location) => location.roleLocationPresets, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "location_id" })
  location!: Location;

  @Column()
  location_id!: number; // Explicitly define the foreign key column

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.roleLocationPresets, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 }) // Default status_id to 1 (active)
  status_id!: number; // Explicitly define the foreign key column

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
  created_by!: number; // Explicitly define the foreign key column

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedRoleLocationPresets, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy?: User; // Optional for updates

  @Column({ nullable: true })
  updated_by?: number; // Explicitly define the foreign key column, optional

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  modified_at!: Date;
}
