import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { ApprovalMatrix } from "./ApprovalMatrix";
import { ApprovalMatrixLevels } from "./ApprovalMatrixLevels";
import { Module } from "./Module";
@Entity({ name: "approval_matrix_details" })
export class ApprovalMatrixDetails {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  header_id: number;

  @Column()
  approval_title: string;

  @Column()
  userid: string;

  @Column({ nullable: true })
  module: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

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
  })
  updated_at: Date;

  //Relationships

  @ManyToOne(() => Module)
  @JoinColumn({ name: "module" })
  ModuleName: Module;

  @ManyToOne(() => ApprovalMatrix, (header) => header.lines)
  @JoinColumn({ name: "header_id" })
  header: ApprovalMatrix;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userid" })
  userMaker: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  //Relationships
  @OneToMany(() => ApprovalMatrixLevels, (item) => item.approvalmatrixDetail, {
    cascade: true,
  })
  approvalmatrixLevel: ApprovalMatrixLevels[];
}
