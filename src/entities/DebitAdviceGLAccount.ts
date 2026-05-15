import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("debit_advice_gl_accounts")
export class DebitAdviceGlAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "GLCODE",
    length: 100,
    unique: true,
  })
  gl_code: string;

  @Column({
    name: "CATEGORYCODE",
    length: 100,
  })
  category_code: string;

  @Column({
    name: "CATEGORYNAME",
    length: 255,
  })
  category_name: string;

  @Column({
  name: "GLNAME",
  length: 255,
  })
  gl_name: string;

  @Column({
  name: "OLDCODE",
  length: 100,
  nullable: true,
  })
  old_code: string;

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