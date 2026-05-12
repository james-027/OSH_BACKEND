import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Status } from "./Status";
import { CategoryType } from "./CategoryType";
import { AuditForm } from "./AuditForm";
import { User } from "./User";

@Entity("audit_form_category_types")
export class AuditFormCategoryTypes {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  audit_form_id: number;

  @Column()
  category_type_id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  modified_at: Date;

  // Relations
  @ManyToOne(() => Status, { eager: false })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => CategoryType, { eager: false })
  @JoinColumn({ name: "category_type_id" })
  categoryType: CategoryType;
  
  @ManyToOne(() => AuditForm, { eager: false })
  @JoinColumn({ name: "audit_form_id" })
  auditForm: AuditForm;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;
}
