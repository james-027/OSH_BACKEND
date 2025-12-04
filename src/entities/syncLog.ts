import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity({ name: "sync_logs" })
export class SyncLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  module: string;

  @Column()
  type: string;

  @Column()
  action: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "text", nullable: true })
  row_data: string;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;
}
