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


@Entity("transaction_attachments")
export class TransactionAttachment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    module: string;

    @Column({ nullable: true })
    reference_id: number;

    @Column()
    document_number: string;

    @Column()
    file_name: string;

    @Column()
    original_name: string;

    @Column()
    file_path: string;

    @Column()
    mime_type: string;

    @Column()
    file_size: number;

    @Column()
    isdeleted: number;

    @Column()
    deleted_by: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: "created_by" })
    createdBy: User;


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

}