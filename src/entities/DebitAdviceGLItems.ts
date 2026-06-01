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


@Entity({ name: "debit_advice_gl_items" })
export class DebitAdviceGLItems {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    line_id: number;

    @Column({ nullable: true })
    ref_docno: string;

    @ManyToOne(() => DebitAdviceLine, (line) => line.glItems)
    @JoinColumn({ name: "line_id" })
    debitAdviceLine: DebitAdviceLine;

    @Column({ length: 255 })
    profitcenter_code: string;

    @Column({ length: 100 })
    gl_code: string;

    @Column({ length: 500 })
    Remarks: string;


    @Column({ type: "decimal", precision: 18, scale: 2 })
    amount: number;



    @CreateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    created_at: Date;


    @ManyToOne(() => User)
    @JoinColumn({ name: "created_by" })
    createdBy: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "updated_by" })
    updatedBy: User;

    @UpdateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    updated_at: Date;


}