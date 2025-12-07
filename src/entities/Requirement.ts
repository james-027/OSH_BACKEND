import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { RenewalType } from "./RenewalType";
import { RequirementReminder } from "./RequirementReminder";
import { WarehouseRequirement } from "./WarehouseRequirement";
import { ReqTransactionHeader } from "./ReqTransactionHeader";

@Entity("requirements")
@Unique("UQ_requirement_name", ["requirement_name"])
export class Requirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  requirement_name: string;

  @Column({ length: 255 })
  requirement_abbr_name: string;

  @Column()
  renewal_type_id: number;

  /**
   * The number of days before the requirement is due to send a reminder.
   */
  @Column({
    comment:
      "The number of days before the requirement is due to send a reminder.",
  })
  requirement_reminder: number;

  /**
   * Start (number of month) to start counting the requirement from.
   */
  @Column({
    comment: "Start (number of month) to start counting the requirement from.",
  })
  requirement_start: number;

  @Column({
    comment: "Start (number of days) to start counting the requirement from.",
  })
  requirement_start_days: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  modified_at: Date;

  @ManyToOne(() => Status, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  // Foreign key to renewal type entity
  @ManyToOne(() => RenewalType, (renewalType) => renewalType.requirements, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "renewal_type_id" })
  renewalType!: RenewalType;

  @OneToMany(
    () => RequirementReminder,
    (reqReminder) => reqReminder.requirement
  )
  requirementReminders!: RequirementReminder[];

  @OneToMany(
    () => WarehouseRequirement,
    (warehouseRequirement) => warehouseRequirement.requirement
  )
  warehouseRequirements!: WarehouseRequirement[];

  @OneToMany(
    () => ReqTransactionHeader,
    (reqTransactionHeader) => reqTransactionHeader.requirement
  )
  reqTransactionHeaders!: ReqTransactionHeader[];
}
