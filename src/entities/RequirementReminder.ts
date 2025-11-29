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
import { Requirement } from "./Requirement";
import { ReminderType } from "./ReminderType";

@Entity("requirement_reminders")
export class RequirementReminder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  requirement_id: number;

  @Column()
  reminder_type_id: number;

  @Column()
  reminder_count_day: number;

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

  // Foreign key to reminder type entity
  @ManyToOne(
    () => ReminderType,
    (reminderType) => reminderType.requirementReminders,
    {
      eager: true,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "reminder_type_id" })
  reminderType!: ReminderType;

  // Foreign key to requirement entity
  @ManyToOne(
    () => Requirement,
    (requirement) => requirement.requirementReminders,
    {
      eager: true,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "requirement_id" })
  requirement!: Requirement;
}
