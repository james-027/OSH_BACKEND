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
import { User } from "./User";

@Entity("audit_forms")
export class AuditForm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255})
  audit_form_name: string;

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

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;
}
