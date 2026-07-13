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
import { Company } from "./Company";

@Entity("suppliers")
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "supplier_code",
    length: 100,
    unique: true,
  })
  supplier_code: string;

  @Column({
    name: "supplier_name",
    length: 255,
    nullable: true,
  })
  supplier_name: string;

  @Column({
    name: "old_code",
    length: 100,
    nullable: true,
  })
  old_code: string;

  @Column({
    name: "group_name",
  })
  group_name: string;

  @Column({
    name: "group_code",
  })
  group_code: string;

  @Column({
    name: "taxid",
  })
  taxid: string;

  @Column({
    name: "company",
  })
  company: string;

  // Foreign key to Status entity
  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status!: Status;

  // Foreign key to Company entity
  @ManyToOne(() => Company)
  @JoinColumn({
    name: "company",
    referencedColumnName: "company_abbr",
  })
  companyCode!: Company;

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
