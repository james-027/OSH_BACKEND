import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { Status } from "./Status";
import { User } from "./User";
@Entity("gl_accounts")
export class GLAccounts {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "gl_code",
    length: 100,
    unique: true,
  })
  gl_code: string;

  @Column({
    name: "gl_name",
    length: 255,
  })
  gl_name: string;

  @Column({
    name: "old_code",
    length: 100,
    nullable: true,
  })
  old_code: string;

  @Column({
    name: "company",
    length: 255,
    nullable: true,
  })
  company: string;

  @Column({
    name: "created_by",
    nullable: true,
  })
  created_by: number;

  @Column({
    name: "updated_by",
    nullable: true,
  })
  updated_by: number;

  // Foreign key to Status entity
  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;
}
