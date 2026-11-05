import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";

@Entity("crew_hub_systems")
export class CrewHubSystem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  system_abbr: string;

  @Column({ length: 255 })
  system_name: string;

  @Column({ length: 500 })
  system_url: string;

  @Column({ length: 500, nullable: true })
  system_icon: string;

  @Column({ type: "text", nullable: true })
  system_description: string;

  @Column({ default: 1 })
  system_status: number;

  @Column({ default: 0 })
  order_seq: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  modified_at: Date;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => Status, { eager: false, nullable: true })
  @JoinColumn({ name: "system_status" })
  status: Status;
}
