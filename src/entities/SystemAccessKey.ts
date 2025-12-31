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
import { System } from "./System";
import { AccessKey } from "./AccessKey";

@Entity("system_access_keys")
export class SystemAccessKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  access_key_id: number;

  @Column()
  system_id: number;

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

  @ManyToOne(() => System, (system) => system.system_access_keys, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "system_id" })
  system!: System;

  @ManyToOne(() => AccessKey, (accessKey) => accessKey.system_access_keys, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey!: AccessKey;
}
