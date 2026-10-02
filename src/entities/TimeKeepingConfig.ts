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
import { AccessKey } from "./AccessKey";

@Entity("time_keeping_configs")
export class TimeKeepingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  time_in_grace_period: number;

  @Column({ nullable: true })
  break_grace_period_min: number;

  @Column({ nullable: true })
  break_grace_period_mid: number;

  @Column({ nullable: true })
  break_grace_period_max: number;

  @Column({ nullable: true })
  break_period_add_mins_min: number;

  @Column({ nullable: true })
  break_period_add_mins_mid: number;

  @Column({ nullable: true })
  break_period_add_mins_max: number;
  
  @Column({ nullable: true })
  full_duty_auto_break: number;

  @Column({ type: 'boolean', default: false })
  cash_bond: boolean;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ default: 1 })
  status_id: number;

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

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;
}
