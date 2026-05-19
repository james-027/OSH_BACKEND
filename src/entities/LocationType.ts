import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User"; // Import User entity for foreign keys
import { Status } from "./Status"; // Import Status entity for foreign key
import { Location } from "./Location";

@Entity()
export class LocationType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true }) // Assuming location_type_name should be unique
  location_type_name!: string;

  // Foreign key to Status entity
  @ManyToOne(() => Status, (status) => status.locationTypes, {
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
  @ManyToOne(() => User, (user) => user.createdLocationTypes, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @Column()
  created_by!: number; // Explicitly define the foreign key column

  // Foreign key to User entity for updated_by
  @ManyToOne(() => User, (user) => user.updatedLocationTypes, {
    eager: false,
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

  @OneToMany(() => Location, (location) => location.locationType)
  locations!: Location[];
}
