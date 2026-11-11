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
import { Module } from "./Module";

@Entity("signatory_headers")
export class SignatoryHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ nullable: true })
  module_id: number;

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

  @ManyToOne(() => AccessKey, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @ManyToOne(() => Module, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "module_id" })
  module: Module;
}


