import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { Status } from "./Status";
import { CategoryType } from "./CategoryType";
import { AuditForm } from "./AuditForm";
import { User } from "./User";
import { Warehouse } from "./Warehouse";
import { Employee } from "./Employee";
import { Location } from "./Location";
import { AuditFormDetails } from "./AuditFormDetails";

@Entity("audit_form_details_history")
@Unique("UQ_audit_reference_id", ["audit_reference_id"])
export class AuditFormDetailsHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  audit_form_details_id: number;

  @ManyToOne(() => AuditFormDetails, { eager: false })
  @JoinColumn({ name: "audit_form_details_id" })
  auditFormDetails: AuditFormDetails;

  @Column({ type: "varchar", length: 100, nullable: true })
  audit_reference_id: string;

  @Column({ nullable: true })
  audit_month: string;

  @Column({ type: "date", nullable: true })
  audit_date: Date;

  @Column({ nullable: true })
  store_crew_name: string;

  @Column({ nullable: true })
  store_crew_code: string;

  @Column({ nullable: true })
  agency: string;

  @Column({ type: "decimal", nullable: true })
  food_safety_score: number;

  @Column({ type: "decimal", nullable: true })
  work_instruction_score: number;

  @Column({ type: "decimal", nullable: true })
  product_quality_score: number;

  @Column({ type: "decimal", nullable: true })
  ssop_score: number;

  @Column({ type: "decimal", nullable: true })
  audit_final_score: number;

  @Column({ type: "timestamp", nullable: true })
  computed_at: Date;
  
  @Column({ nullable: true })
  audit_by: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "audit_by" })
  auditBy: Employee;
  
  @Column({ nullable: true })
  store_id: number;

  @ManyToOne(() => Warehouse, { eager: false })
  @JoinColumn({ name: "store_id" })
  store: Warehouse;

  @Column({ nullable: true })
  store_specialist_id: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "store_specialist_id" })
  storeSpecialist: Employee;

  @Column({ nullable: true })
  area_head_id: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "area_head_id" })
  areaHead: Employee;

  @Column({ nullable: true })
  group_area_head_id: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "group_area_head_id" })
  groupAreaHead: Employee;

  @Column({ nullable: true })
  location_id: number;

  @ManyToOne(() => Location, { eager: false })
  @JoinColumn({ name: "location_id" })
  location: Location;

  @Column({ nullable: true })
  group_business_center_head_id: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "group_business_center_head_id" })
  groupBusinessCenterHead: Employee;

  @Column({ nullable: true })
  regional_head_id: number;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: "regional_head_id" })
  regionalHead: Employee;

  @Column({ default: 1 })
  status_id: number;

  @ManyToOne(() => Status, { eager: false })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @Column({ nullable: true })
  audit_form_id: number;

  @ManyToOne(() => AuditForm, { eager: false })
  @JoinColumn({ name: "audit_form_id" })
  auditForm: AuditForm;

  @Column({ nullable: true })
  created_by: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @Column({ nullable: true })
  updated_by: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  modified_at: Date;
}