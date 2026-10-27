import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { WeighIn_header } from "./WeighInHeader";

@Entity({ name: "weigh_in_line" })
export class WeighInLine {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    header_id: number;

    @ManyToOne(() => WeighIn_header, (header) => header.lines)
    @JoinColumn({ name: "header_id" })
    header: WeighIn_header;

    @Column()
    po_number: string;

    @Column({ type: "decimal", precision: 18, scale: 2 })
    weight: number;

    @Column({ length: 50 })
    unit: string;

    @Column({ type: "int" })
    heads: number;

    @Column({ type: "timestamp", nullable: true })
    weigh_timestamp: Date;

    // --- STANDARD AUDIT & STATUS FIELDS ---
    @Column({ default: 1 })
    status_id: number;

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

    @UpdateDateColumn({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
    })
    updated_at: Date;

    // --- RELATIONSHIPS ---
    @ManyToOne(() => Status)
    @JoinColumn({ name: "status_id" })
    status: Status;

    @ManyToOne(() => User)
    @JoinColumn({ name: "created_by" })
    createdBy: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "updated_by" })
    updatedBy: User;
}