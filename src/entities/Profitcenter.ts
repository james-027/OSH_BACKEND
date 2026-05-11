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
    name: "PROFITCENTER",
    length: 100,
    unique: true,
  })
  profitcenter_code: string;

  @Column({
    name: "PROFITCENTERNAME",
    length: 255,
  })
  profitcenter_name: string;

  @Column({
    name: "OLDCODE",
    length: 100,
    nullable: true,
  })
  old_code: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ default: 1 })
  created_by_id: number;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updated_at: Date;
}