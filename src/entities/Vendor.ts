import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { Category } from "./Category";

@Entity("vendors")
@Unique("UQ_service_provider_code", ["service_provider_code"])
export class Vendor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  service_provider_name: string;

  @Column({ length: 255 })
  service_provider_code: string;

  @Column()
  category_id: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  tax: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  vat: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  asf: number;

  @Column({ nullable: true })
  erp_id: number;git

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

  @ManyToOne(() => Category, {
    eager: false,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "category_id" })
  category: Category;
}
