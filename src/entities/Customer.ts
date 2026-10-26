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

@Entity("customers")
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "custno",
    length: 100,
    unique: true,
  })
  custno: string;

  @Column({
    name: "custname",
    length: 255,
    nullable: true,
  })
  custname: string;

  @Column({
    name: "customergroup",
    nullable: true,
  })
  customergroup: string;

  @Column({
    name: "tin_id",
    nullable: true,
  })
  tin_id: string;

  @Column({
    name: "bill_to_address",
    type: "text",
    nullable: true,
  })
  bill_to_address: string;

  @Column({
    name: "ship_to_address",
    type: "text",
    nullable: true,
  })
  ship_to_address: string;

  @Column({
    name: "company",
    length: 100,
    nullable: true,
  })
  company?: string;

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