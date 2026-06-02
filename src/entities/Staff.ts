import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { Location } from "./Location";
import { Vendor } from "./Vendor";
import { Position } from "./Position";
import { AccessKey } from "./AccessKey";
import { StaffBrand } from "./StaffBrand";
import { StaffCategoryType } from "./StaffCategoryType";
import { StaffVendorSalary } from "./StaffVendorSalary";

@Entity("staffs")
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, nullable: true })
  staff_code: string;

  @Column({ length: 255 })
  last_name: string;

  @Column({ length: 255 })
  first_name: string;

  @Column({ length: 255, nullable: true })
  middle_name: string;

  @Column()
  location_id: number;

  @Column()
  vendor_id: number;

  @Column()
  assign_status_id: number;

  @Column()
  position_id: number;

  @Column({ length: 255, nullable: true })
  sss_number: string;

  @Column({ length: 255, nullable: true })
  pagibig_number: string;

  @Column({ length: 255, nullable: true })
  tin: string;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column({ type: "date", nullable: true })
  hired_date: Date;

  @Column({ type: "date", nullable: true })
  to_hr_date: Date;

  @Column({ type: "date", nullable: true })
  to_sts_date: Date;

  @Column({ type: "date", nullable: true })
  approved_eprf_date: Date;

  @Column({ type: "date", nullable: true })
  req_completion_date: Date;

  @Column({ type: "date", nullable: true })
  actual_deployment_date: Date;

  @Column({ type: "date", nullable: true })
  separated_date: Date;

  @Column({ type: "date", nullable: true })
  birthday: Date;

  @Column({ type: "text", nullable: true })
  contact_number: string;

  @Column({ type: "text", nullable: true })
  overall_remarks: string;

  @Column({ type: "text", nullable: true })
  store_request: string;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ default: 1 })
  status_id: number;

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

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "assign_status_id" })
  assignmentStatus: Status;

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

  @ManyToOne(() => Location, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "location_id" })
  location: Location;

  @ManyToOne(() => Vendor, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "vendor_id" })
  vendor: Vendor;

  @ManyToOne(() => Position, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "position_id" })
  position: Position;

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;


  @OneToMany(() => StaffBrand, (staffBrand) => staffBrand.staff)
  staffBrands: StaffBrand[];

  @OneToMany(() => StaffCategoryType, (staffCategoryType) => staffCategoryType.staff)
  staffCategoryTypes: StaffCategoryType[];

  @OneToMany(() => StaffVendorSalary, (staffVendorSalary) => staffVendorSalary.staff)
  staffVendorSalaries: StaffVendorSalary[];
}
