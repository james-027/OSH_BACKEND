import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Location } from "./Location";
import { Status } from "./Status";
import { User } from "./User";
import { LocationHurdleCategory } from "./LocationHurdleCategory";

@Entity("location_hurdles")
@Unique(["location_id", "hurdle_date"])
export class LocationHurdle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  location_id: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  location_rate: number;

  @Column("int")
  ss_hurdle_qty: number;

  @Column({ type: "date" })
  hurdle_date: string;

  @Column({ default: 1 })
  status_id: number;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @ManyToOne(() => Location)
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @OneToMany(() => LocationHurdleCategory, (cat) => cat.locationHurdle)
  locationHurdleCategories: LocationHurdleCategory[];

  @Column({ type: "text", nullable: true })
  undo_reason?: string;
}
