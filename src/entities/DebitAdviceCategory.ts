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
    name: "CATEGORYCODE",
    length: 100,
    unique: true,
  })
  category_code: string;

  @Column({
    name: "CATEGORYNAME",
    length: 255,
  })
  category_name: string;

  @Column({
    name: "OLDCODE",
    length: 100,
    nullable: true,
  })
  old_code: string;

  @Column({
    name: "COMPANY",
    length: 255,
    nullable: true,
  })
  company: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ default: 1 })
  created_by_id: number;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updated_at: Date;
}