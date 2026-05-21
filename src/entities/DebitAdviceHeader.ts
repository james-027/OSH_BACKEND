import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { DebitAdviceLine } from "./DebitAdviceItems";

// creating main entity for debit advice and line items as supporting entity. This will allow us to have multiple line items for a single debit advice, 
// which is a common scenario in financial transactions. The main entity will represent the overall debit advice, while the line 
// items will capture the details of each individual transaction entry.



@Entity({ name: "debit_advice" })
export class DebitAdvice_header {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    document_number: string;

    @Column({ type: "date" })
    transaction_date: Date;


    @Column({ default: 1 })
    status_id: number;

    @Column({ nullable: true })
    created_by: number;


    @CreateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    created_at: Date;

    @UpdateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    updated_at: Date;


    @ManyToOne(() => Status)
    @JoinColumn({ name: "status_id" })
    status: Status;

    @ManyToOne(() => User)
    @JoinColumn({ name: "created_by" })
    createdBy: User;

    // Relationship to Line Items
    @OneToMany(() => DebitAdviceLine, (line) => line.header, { cascade: true })
    lines: DebitAdviceLine[];
}

