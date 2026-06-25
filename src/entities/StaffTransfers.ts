import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Vendor } from "./Vendor";
import { Location } from "./Location";
import { User } from "./User";
import { Staff } from "./Staff";
import { AccessKey } from "./AccessKey";

@Entity("staff_transfers")
export class StaffTransfers {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  staff_id: number;

  @Column()
  old_vendor_id: number;

  @Column()
  new_vendor_id: number;

  @Column()
  old_location_id: number;

  @Column()
  new_location_id: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  salary_rate: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  allowance: number;

  @Column({ type: "timestamp" })
  effectivity_date: Date;

  @Column({ nullable: true, type: "text" })
  remarks: string;

  @Column({
    type: "boolean",
    default: false,
  })
  status: boolean;



  @Column()
  access_key_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @ManyToOne(() => Staff, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "staff_id" })
  staff: Staff;


  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;


  @ManyToOne(() => AccessKey, {
    eager: false,
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

    @ManyToOne(() => Vendor, {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    })
    @JoinColumn({ name: "new_vendor_id" })
    vendor: Vendor;

    @ManyToOne(() => Location, {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    })
    @JoinColumn({ name: "new_location_id" })
    location: Location;

  
}