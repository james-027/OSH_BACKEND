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

@Entity({ name: "approval_matrix" })
export class ApprovalMatrix {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  userid: number;

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

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userid" })
  userMaker: User;

  // Relationship to Line Items
  @OneToMany(() => ApprovalMatrixDetails, (line) => line.header, {
    cascade: true,
  })
  lines: ApprovalMatrixDetails[];
}
