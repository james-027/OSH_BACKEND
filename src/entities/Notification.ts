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
import { Module } from "./Module";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";
import { NotificationRecipient } from "./NotificationRecipient";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  module_id: number;

  @ManyToOne(() => Module, { eager: true })
  @JoinColumn({ name: "module_id" })
  module: Module;

  @Column({ type: "int", nullable: true })
  access_key_id: number | null;

  @ManyToOne(() => AccessKey, { eager: false, nullable: true })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  event_code: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  title: string | null;

  @Column()
  ref_id: number;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  action_url: string | null;

  @Column({ type: "json", nullable: true })
  raw_data: any;

  // Legacy column preserved for backward compatibility
  @Column({ nullable: true })
  to_user_id: number | null;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "to_user_id" })
  toUser: User;

  @Column({ default: 1 })
  status_id: number;

  @ManyToOne(() => Status, { eager: true })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @Column()
  created_by: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @Column({ nullable: true })
  updated_by: number | null;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  // Multi-recipient tracking
  @OneToMany(() => NotificationRecipient, (rec) => rec.notification, {
    cascade: true,
  })
  recipients: NotificationRecipient[];
}
