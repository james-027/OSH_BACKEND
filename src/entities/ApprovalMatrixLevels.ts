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
import { Status } from "./Status";
import { ApprovalMatrixDetails } from "./ApprovalMatrixDetails";

@Entity({ name: "approval_matrix_levels" })
export class ApprovalMatrixLevels {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  module: string;

  @Column({ nullable: true })
  approval_title: string;

  @Column({
    nullable: true,
    unique: true,
  })
  approval_id: string;

  @Column({ nullable: true })
  opt_approval_id: string;

  @Column({ default: 1 })
  status_id: number;

  @Column()
  userid: string;

  @Column()
  level: string;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  //Relationships

  @ManyToOne(() => ApprovalMatrixDetails, (line) => line.approvalmatrixLevel)
  @JoinColumn({
    name: "approval_id",
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
