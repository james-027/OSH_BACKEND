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
import { WarehouseRequirement } from "./WarehouseRequirement";

@Entity("warehouse_requirement_starts")
@Unique("UQ_wh_req_id_req_start", [
  "warehouse_requirement_id",
  "warehouse_requirement_start",
])
export class WarehouseRequirementStart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_requirement_id: number;

  @Column({ type: "date" })
  warehouse_requirement_start: string;

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

  // Foreign key to requirement entity
  @ManyToOne(
    () => WarehouseRequirement,
    (warehouseRequirement) => warehouseRequirement.warehouseRequirementStarts,
    {
      eager: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    }
  )
  @JoinColumn({ name: "warehouse_requirement_id" })
  warehouseRequirement!: WarehouseRequirement;
}
