import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("debit_advice_categories")
export class DebitAdviceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "categorycode",
    length: 100,
    unique: true,
  })
  category_code: string;

  @Column({
    name: "categoryname",
    length: 255,
  })
  category_name: string;

  @Column({
    name: "oldcode",
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

  @Column({ default: 1 })
  status_id: number;

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