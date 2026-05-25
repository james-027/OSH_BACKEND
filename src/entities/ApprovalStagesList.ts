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
import { DebitAdvice_header } from "./DebitAdviceHeader";
import { User } from "./User";

@Entity({ name: "approval_stageslist" })
export class ApprovalStagesList {
  @PrimaryGeneratedColumn()
  id: number;

  // FK -> debit_advice.id
  @Column()
  debit_advice_id: number;

  @ManyToOne(() => DebitAdvice_header)
  @JoinColumn({ name: "debit_advice_id" })
  debitAdvice: DebitAdvice_header;

  // document reference
  @Column()
  document_number: string;

  @Column({ type: "date" })
  transaction_date: Date;

  // approval workflow series/order
  @Column()
  series: number;

  // approval date
  @Column({
    type: "timestamp",
    nullable: true,
  })
  approval_date: Date;

   //  approver
  @Column({
    type: "text",
    nullable: true,
  })
  approverid: string;

     //  approver
  @Column({
    type: "text",
    nullable: true,
  })
  approverid_opt: string;

  // optional approver remarks
  @Column({
    type: "text",
    nullable: true,
  })
  approval_remarks: string;

  // approval status
  @Column({ default: 1 })
  status_id: number;


  // audit columns
  @Column({ nullable: true })
  created_by: number;


  @Column({ nullable: true })
  updated_by: number

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "approverid" })
  approver: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "approverid_opt" })
  optionalApprover: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;


  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;
}