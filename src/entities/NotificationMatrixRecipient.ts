import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { NotificationMatrix } from "./NotificationMatrix";
import { Role } from "./Role";
import { User } from "./User";
import { Status } from "./Status";

@Entity("notification_matrix_recipients")
export class NotificationMatrixRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  matrix_id: number;

  @ManyToOne(() => NotificationMatrix, (matrix) => matrix.recipients, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "matrix_id" })
  matrix: NotificationMatrix;

  @Column()
  role_id: number;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: "role_id" })
  role: Role;

  // If user_id is null, ALL active users under this role_id are notified dynamically.
  // If user_id is specified, only that selected user under the role is notified.
  @Column({ type: "int", nullable: true })
  user_id: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: "user_id" })
  user: User | null;

  @Column({ default: 1 })
  status_id: number;

  @ManyToOne(() => Status, { eager: true })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @Column({ nullable: true })
  created_by: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @Column({ nullable: true })
  updated_by: number;

  @ManyToOne(() => User, { nullable: true })
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
  modified_at: Date;
}

