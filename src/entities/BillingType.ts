import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";

@Entity("billing_types")
@Unique("UQ_billing_type_name", ["billing_type_name"])
@Unique("UQ_billing_type_abbr", ["billing_type_abbr"])
export class BillingType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  billing_type_name!: string;

  @Column({ unique: true })
  billing_type_abbr!: string;

  @Column({ default: 1 })
  status_id!: number;

  @Column({ nullable: true })
  created_by!: number;

  @Column({ nullable: true })
  updated_by!: number | null;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at!: Date;

  // Relationships
  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User | null;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "status_id" })
  status!: Status;
}
