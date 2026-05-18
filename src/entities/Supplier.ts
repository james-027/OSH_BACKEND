import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("suppliers")
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "SUPPLIERCODE",
    length: 100,
    unique: true,
  })
  suppliercode: string;

  @Column({
    name: "SUPPLIERNAME",
    length: 255,
    nullable: true,
  })
  suppliername: string;

  @Column({
    name: "OLDCODE",
    length: 100,
    nullable: true,
  })
  oldcode: string;

  @Column({
    name: "status_id",
    default: 1,
  })
  status_id: number;

  @Column({
    name: "created_by_id",
    default: 1,
  })
  created_by_id: number;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updated_at: Date;
}