import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";

@Entity("user_audit_trail")
export class UserAuditTrail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  service: string;

  @Column({ type: "varchar", length: 255 })
  method: string;

  @Column({ type: "longtext", nullable: true })
  raw_data: string;

  @Column({ type: "mediumtext", nullable: true })
  description: string;

  @Column({ type: "int", default: 1 })
  status_id: number;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @Column({ type: "int" })
  created_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;
}
