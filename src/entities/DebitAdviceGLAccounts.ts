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

@Entity("debit_advice_gl_accounts")
export class DebitAdviceGLAccounts {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "glcode",
    length: 100,
    unique: true,
  })
  gl_code: string;

  @Column({
    name: "categorycode",
    length: 100,
  })
  category_code: string;

  @Column({
    name: "categoryname",
    length: 255,
  })
  category_name: string;

  @Column({
    name: "glname",
    length: 255,
  })
  gl_name: string;

  @Column({
    name: "oldcode",
    length: 100,
    nullable: true,
  })
  old_code: string;

  // Foreign key to Status entity
  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

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