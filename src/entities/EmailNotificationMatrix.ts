import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { Module } from "./Module";
import { EmailNotificationMatrixDetails } from "./EmailNotificationMatrixDetails";

@Entity({ name: "email_notification_matrix" })
export class EmailNotificationMatrix {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  module: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  smtp_email: string;

  // SMTP server configuration (mirrors U_SERVERNAME/U_PORT/U_SECURITY/U_AUTHMETHOD/U_USERNAME/U_PASSWORD)
  @Column({ type: "varchar", length: 255, nullable: true })
  smtp_server: string;

  @Column({ type: "int", nullable: true })
  smtp_port: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  smtp_security: string;

  @Column({ type: "int", nullable: true })
  smtp_auth_method: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  smtp_username: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  smtp_password: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

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
  })
  updated_at: Date;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => Module)
  @JoinColumn({ name: "module", referencedColumnName: "id" })
  moduleData: Module;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  // Relationship to Line Items
  @OneToMany(() => EmailNotificationMatrixDetails, (line) => line.header, {
    cascade: true,
  })
  lines: EmailNotificationMatrixDetails[];
}
