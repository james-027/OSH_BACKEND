import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Transaction Sequence Entity
 * Stores the last used sequence number for each transaction type, location, access_key, and year combination
 * Used for generating transaction numbers with database-level locking to prevent race conditions
 */
@Entity("transaction_sequences")
@Index(["transaction_type", "location_id", "access_key_id", "year"], {
  unique: true,
})
@Index(["transaction_type"], {})
export class TransactionSequence {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Type of transaction (e.g., 'SALES', 'PURCHASE', 'TRANSFER', etc.)
   * Allows multiple transaction types to have independent sequences
   */
  @Column({ type: "varchar", length: 50 })
  transaction_type: string;

  /**
   * Location ID - used as part of sequence scope
   * Allows each location to have independent sequences
   */
  @Column({ type: "int" })
  location_id: number;

  /**
   * Access Key ID - used as part of sequence scope
   * Allows each access key to have independent sequences
   */
  @Column({ type: "int" })
  access_key_id: number;

  /**
   * Year for sequence - typically resets per year
   * Allows sequences to restart annually
   */
  @Column({ type: "int" })
  year: number;

  /**
   * Current sequence number (counter)
   * Incremented atomically with SELECT FOR UPDATE locking
   */
  @Column({ type: "int", default: 0 })
  current_sequence: number;

  /**
   * Optional: Configuration for whether to reset per year
   * true = reset counter each year (default behavior)
   * false = continuous counter across years
   */
  @Column({ type: "boolean", default: true })
  reset_per_year: boolean;

  /**
   * Optional: Prefix format template
   * e.g., "{location_abbr}{access_key_id}{year}-"
   * Stored for reference/audit purposes
   */
  @Column({ type: "varchar", length: 255, nullable: true })
  format_template: string;

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
}
