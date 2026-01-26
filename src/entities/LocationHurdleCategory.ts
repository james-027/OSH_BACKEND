import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Location } from "./Location";
import { ItemCategory } from "./ItemCategory";
import { Status } from "./Status";
import { User } from "./User";
import { LocationHurdle } from "./LocationHurdle";

@Entity("location_hurdle_categories")
export class LocationHurdleCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  location_id: number;

  @Column()
  item_category_id: number;

  @Column({ default: 1 })
  status_id: number;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @Column({ nullable: true })
  created_by: number;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  location_hurdle_id: number;

  @ManyToOne(() => Location)
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => ItemCategory)
  @JoinColumn({ name: "item_category_id" })
  itemCategory: ItemCategory;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => LocationHurdle, { nullable: true })
  @JoinColumn({ name: "location_hurdle_id" })
  locationHurdle: LocationHurdle;
}
