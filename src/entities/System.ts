import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Status } from "./Status";
import { User } from "./User";
import { SystemAccessKey } from "./SystemAccessKey";
import { Role } from "./Role";

@Entity("systems")
export class System {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, unique: true })
  system_name: string;

  @Column({ length: 50 })
  system_abbr: string;

  @Column({ default: 1 })
  status_id: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  modified_at: Date;

  // Relations
  @ManyToOne(() => Status, { eager: false })
  @JoinColumn({ name: "status_id" })
  status: Status;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy: User;

  @OneToMany(() => SystemAccessKey, (systemAccessKey) => systemAccessKey.system)
  system_access_keys!: SystemAccessKey[];

  @OneToMany(() => Role, (role) => role.system)
  roles!: Role[];
}
