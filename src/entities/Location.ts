import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from "typeorm"; // NEW: Unique
import { LocationType } from "./LocationType"; // Import LocationType entity for foreign key
import { Status } from "./Status"; // Import Status entity for foreign key
import { User } from "./User"; // Import User entity for foreign keys
import { RoleLocationPreset } from "./RoleLocationPreset";
import { UserLocations } from "./UserLocations";
import { Region } from "./Region"; // Import Region entity for foreign key
import { ReqTransactionHeader } from "./ReqTransactionHeader";

// @Unique(["location_name"]) // Add unique constraint to location_name
@Entity()
export class Location {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true }) // Add unique constraint to location_name
  location_name!: string; // Add location_name field

  @Column({ length: 50, unique: true, nullable: false })
  location_code!: string;

  @Column({ length: 20, nullable: true })
  location_abbr?: string;

  // Foreign key to LocationType entity
  @ManyToOne(() => LocationType, (locationType) => locationType.locations, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "location_type_id" })
  locationType!: LocationType;

  @Column()
  location_type_id!: number; // Explicitly define the foreign key column

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.locations, {
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
  @ManyToOne(() => User, (user) => user.createdLocations, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number; // Explicitly define the foreign key column

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedLocations, {
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

  // Foreign key to Region entity
  @ManyToOne(() => Region, { eager: true, nullable: true })
  @JoinColumn({ name: "region_id" })
  region?: Region;

  @Column({ nullable: true })
  region_id?: number;

  // Relationship for location_id in RoleLocationPreset
  @OneToMany(() => RoleLocationPreset, (preset) => preset.location)
  roleLocationPresets!: RoleLocationPreset[];

  // Relationship for location_id in UserLocations
  @OneToMany(() => UserLocations, (userLocations) => userLocations.location)
  userLocations!: UserLocations[];

  @OneToMany(
    () => ReqTransactionHeader,
    (reqTransactionHeader) => reqTransactionHeader.location
  )
  reqTransactionHeaders!: ReqTransactionHeader[];
}
