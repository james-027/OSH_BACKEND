import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("profitcenters")
export class Profitcenter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "profitcenter",
    length: 100,
    unique: true,
  })
  profitcenter_code: string;

  @Column({
    name: "profitcentername",
    length: 255,
  })
  profitcenter_name: string;

  @Column({
    name: "oldcode",
    length: 100,
    nullable: true,
  })
  old_code: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  })
  updated_at: Date;
}