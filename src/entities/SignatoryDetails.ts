import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { AccessKey } from "./AccessKey";
import { SignatoryHeader } from "./SignatoryHeader";
import { SignatoryType } from "./SignatoryTypes";
import { Position } from "./Position";

@Entity("signatory_details")
export class SignatoryDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  signatory_header_id: number;

  @Column({ nullable: true })
  signatory_type_id: number;

  @Column({ nullable: true })
  position_id: number;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  access_key_id: number;

  @Column({ nullable: true })
  signatoree_id: number;

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

  @ManyToOne(() => AccessKey, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "access_key_id" })
  accessKey: AccessKey;

  @ManyToOne(() => SignatoryHeader, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "signatory_header_id" })
  signatoryHeader: SignatoryHeader;

  @ManyToOne(() => SignatoryType, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "signatory_type_id" })
  signatoryType: SignatoryType;

  @ManyToOne(() => Position, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "position_id" })
  position: Position;

  @ManyToOne(() => User, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "signatoree_id" })
  signatoree: User;
}
