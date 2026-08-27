import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { Status } from "./Status";

export enum MasterDataSyncType {
  SUPPLIERS = "suppliers",
  PROFITCENTER = "profitcenter",
  GL_ACCOUNT = "gl-account",
  DEBIT_ADVICE_CATEGORY = "debit-advice-category",
  DEBIT_ADVICE_GL_ACCOUNT = "debit-advice-gl-account",
}

@Entity("master_data_sync_logs")
export class MasterDataSyncLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "sync_type",
    type: "varchar",
    length: 100,
  })
  sync_type: MasterDataSyncType;

  @Column({
    name: "execution_type",
    type: "varchar",
    length: 20,
    default: "MANUAL",
  })
  execution_type: "MANUAL" | "CRON";

  // ============================================================
  // STATUS
  // 3  = PENDING
  // 23 = FAILED
  // 38 = PROCESSING
  // 39 = COMPLETED
  // ============================================================

  @ManyToOne(() => Status)
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @Column({
    name: "status_id",
  })
  status_id!: number;

  // ============================================================
  // SYNC RESULT
  // ============================================================

  @Column({
    name: "inserted",
    type: "int",
    default: 0,
  })
  inserted: number;

  @Column({
    name: "updated",
    type: "int",
    default: 0,
  })
  updated: number;

  @Column({
    name: "skipped",
    type: "int",
    default: 0,
  })
  skipped: number;

  @Column({
    name: "errors",
    type: "int",
    default: 0,
  })
  errors: number;

  // ============================================================
  // ERROR DETAILS
  // ============================================================

  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
  })
  error_message: string | null;

  // ============================================================
  // AUDIT
  // ============================================================

  @Column({
    name: "executed_by",
    nullable: true,
  })
  executed_by: number | null;

  @Column({
    name: "started_at",
    type: "timestamp",
    nullable: true,
  })
  started_at: Date | null;

  @Column({
    name: "completed_at",
    type: "timestamp",
    nullable: true,
  })
  completed_at: Date | null;

  @Column({
    name: "duration_ms",
    type: "bigint",
    nullable: true,
  })
  duration_ms: number | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;
}
