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
import { AccessKey } from "./AccessKey";

@Entity("positions")
@Unique("UQ_position_name_access_key", ["position_name", "access_key_id"])
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  position_name: string;

  @Column({ length: 50 })
  position_abbr: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  access_key_id: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  modified_at: Date;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ type: "boolean", default: false })
  is_hidden: boolean;

  @ManyToOne(() => Status, { eager: false })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => AccessKey, { eager: false })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @ManyToOne(() => AccessKey, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;
}
