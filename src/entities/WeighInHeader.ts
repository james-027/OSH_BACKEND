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
import { WeighInLine } from "./WeighInItems";

@Entity({ name: "weigh_in_header" })
export class WeighIn_header {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true, nullable: true })
    control_no: string;

    @Column()
    po_number: string;

    @Column({ type: "date", nullable: true })
    transaction_date: Date;

    @Column({ length: 50, default: "ACTIVE" })
    session_status: "ACTIVE" | "COMPLETED";

    @Column({ nullable: true })
    grower: string;

    @Column({ nullable: true })
    farm_location: string;

    @Column({ nullable: true })
    sold_to: string;

    @Column({ type: "text", nullable: true })
    address: string;

    @Column()
    buyer_rep: string;

    @Column({ type: "longtext", nullable: true })
    buyer_signature: string;

    @Column()
    driver_license: string;

    @Column({ type: "longtext", nullable: true })
    driver_license_image: string; // Base64 / URI

    @Column()
    truck_plate: string;

    @Column({ nullable: true })
    target_heads: string;

    // --- SIGN-OFF FIELDS ---
    @Column({ nullable: true })
    checked_by: string;

    @Column({ type: "longtext", nullable: true })
    checked_signature: string;

    @Column({ nullable: true })
    attested_by: string;

    @Column({ type: "longtext", nullable: true })
    attested_signature: string;

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

    // Relationship to Line Items
    @OneToMany(() => WeighInLine, (line) => line.header, { cascade: true })
    lines: WeighInLine[];
}