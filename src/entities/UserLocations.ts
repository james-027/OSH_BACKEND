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
import { Location } from "./Location";
import { Status } from "./Status";
import { AccessKey } from "./AccessKey";

@Entity({ name: "user_locations" })
@Unique("UQ_user_role_location_access", [
  "user_id",
  "role_id",
  "location_id",
  "access_key_id",
])
@Index("IDX_user_locations_lookup", [
  "user_id",
  "role_id",
  "access_key_id",
  "status_id",
])
export class UserLocations {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  role_id!: number;

  @Column()
  location_id!: number;

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
  @ManyToOne(() => User, (user) => user.userLocations, { eager: false })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Role, (role) => role.userLocations, { eager: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Location, (location) => location.userLocations, {
    eager: false,
  })
  @JoinColumn({ name: "location_id" })
  location!: Location;

  @ManyToOne(() => AccessKey, (accessKey) => accessKey.userLocations, {
    eager: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;

  @ManyToOne(() => Status, (status) => status.userLocations, { eager: false })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @ManyToOne(() => User, (user) => user.createdUserLocations, {
    eager: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @ManyToOne(() => User, (user) => user.updatedUserLocations, {
    eager: false,
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User;
}
