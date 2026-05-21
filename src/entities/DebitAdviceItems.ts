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
import { DebitAdvice_header } from "./DebitAdviceHeader";
import { DebitAdviceGLItems } from "./DebitAdviceGLItems";
// creating main entity for debit advice and line items as supporting entity. This will allow us to have multiple line items for a single debit advice, 
// which is a common scenario in financial transactions. The main entity will represent the overall debit advice, while the line 
// items will capture the details of each individual transaction entry.


@Entity({ name: "debit_advice_line" })
export class DebitAdviceLine {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    header_id: number;

    @Column({ nullable: true })
    ref_docno: string;

    @ManyToOne(() => DebitAdvice_header, (header) => header.lines)
    @JoinColumn({ name: "header_id" })
    header: DebitAdvice_header;



    @Column({ length: 255 })
    category: string;

    @Column({ type: "text", nullable: true })
    particulars: string;

    @Column({ length: 100 })
    vendor_code: string;

    @Column({ length: 255 })
    vendor_name: string;

    @Column({ type: "decimal", precision: 18, scale: 2 })
    amount: number;

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


    @ManyToOne(() => User)
    @JoinColumn({ name: "created_by" })
    createdBy: User;



    @UpdateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    updated_at: Date;


    // Relationship to Line Items
    @OneToMany(() => DebitAdviceGLItems, (item) => item.debitAdviceLine, { cascade: true })
    glItems: DebitAdviceGLItems[];
}