import {
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { ApprovalMatrixDetails } from "./ApprovalMatrixDetails";
import { Module } from "./Module";

@Entity({ name: "approval_matrix_levels" })
@Unique(["line_id", "approval_id"])
export class ApprovalMatrixLevels {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  line_id: number;

  @Column({ nullable: true })
  module: string;

  @Column({ nullable: true })
  approval_title: string;

  @Column({
    nullable: true,
  })
  approval_id: number;

  @Column({ nullable: true })
  opt_approval_id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column()
  userid: string;

  @Column()
  level: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  //Relationships

  @ManyToOne(() => ApprovalMatrixDetails, (line) => line.approvalmatrixLevel)
  @JoinColumn({
    name: "line_id",
  })
  approvalmatrixDetail: ApprovalMatrixDetails;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userid" })
  userMaker: User;

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => Module)
  @JoinColumn({ name: "module" })
  moduleData: Module;

  @UpdateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;
}
