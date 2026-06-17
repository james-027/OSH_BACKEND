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

// creating main entity for debit advice and line items as supporting entity. This will allow us to have multiple line items for a single debit advice, 
// which is a common scenario in financial transactions. The main entity will represent the overall debit advice, while the line 
// items will capture the details of each individual transaction entry.


@Entity({ name: "document_posting_log" })
export class DocumentPostingLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "text" })
    module_name: string;

    @Column({ nullable: true })
    ref_docno: string;


    @Column({ nullable: true })
    jv_docno: string;

    @Column({ type: "mediumtext", nullable: true })
    payload: string;

    @Column({ type: "mediumtext", nullable: true })
    remarks: string;


    @ManyToOne(() => Status)
    @JoinColumn({ name: "status_id" })
    status: Status;


    @Column({ nullable: true })
    created_by: number;

    @Column({ nullable: true })
    updated_by: number;

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

    @ManyToOne(() => User)
    @JoinColumn({ name: "updated_by" })
    updatedBy: User;

}