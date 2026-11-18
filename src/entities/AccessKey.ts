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
import { User } from "./User";
import { Status } from "./Status";
import { Company } from "./Company";
import { UserPermissions } from "./UserPermissions";
import { UserLocations } from "./UserLocations";
import { UserWarehouses } from "./UserWarehouses";
import { RoleActionPreset } from "./RoleActionPreset";
import { RoleLocationPreset } from "./RoleLocationPreset";
import { RoleWarehousePreset } from "./RoleWarehousePreset";
import { SystemAccessKey } from "./SystemAccessKey";
import { Position } from "./Position";
import { SalesTerritory } from "./SalesTerritory";

@Entity()
export class AccessKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  access_key_name!: string;

  @Column({ unique: true })
  access_key_abbr!: string;

  @Column()
  company_id!: number;

  @Column({ default: 1 })
  status_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @Column()
  created_by!: number;

  @Column({ nullable: true })
  updated_by!: number | null;

  @UpdateDateColumn()
  modified_at!: Date;

  // Relationships
  @ManyToOne(() => Company, (company) => company.accessKeys)
  @JoinColumn({ name: "company_id" })
  company!: Company;

  @ManyToOne(() => Status, (status) => status.accessKeys, { eager: false })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @ManyToOne(() => User, (user) => user.createdAccessKeys)
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @ManyToOne(() => User, (user) => user.updatedAccessKeys)
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User | null;

  // Relationship for access_key_id in UserPermissions
  @OneToMany(
    () => UserPermissions,
    (userPermissions) => userPermissions.accessKey,
  )
  userPermissions!: UserPermissions[];

  // Relationship for access_key_id in UserLocations
  @OneToMany(() => UserLocations, (userLocations) => userLocations.accessKey)
  userLocations!: UserLocations[];

  // Relationship for access_key_id in UserWarehouses
  @OneToMany(
    () => UserWarehouses,
    (userWarehouses) => userWarehouses.accessKey,
  )
  userWarehouses!: UserWarehouses[];

  // Relationship for access_key_id in RoleActionPreset
  @OneToMany(
    () => RoleActionPreset,
    (roleActionPreset) => roleActionPreset.accessKey,
  )
  roleActionPresets!: RoleActionPreset[];

  // Relationship for access_key_id in RoleLocationPreset
  @OneToMany(
    () => RoleLocationPreset,
    (roleLocationPreset) => roleLocationPreset.accessKey,
  )
  roleLocationPresets!: RoleLocationPreset[];

  // Relationship for access_key_id in RoleWarehousePreset
  @OneToMany(
    () => RoleWarehousePreset,
    (roleWarehousePreset) => roleWarehousePreset.accessKey,
  )
  roleWarehousePresets!: RoleWarehousePreset[];

  // Relationship for users who have this as their current access key
  @OneToMany(() => User, (user) => user.currentAccessKey)
  currentUsers!: User[];

  @OneToMany(
    () => SystemAccessKey,
    (systemAccessKey) => systemAccessKey.accessKey,
  )
  system_access_keys!: SystemAccessKey[];

  @OneToMany(() => Position, (position) => position.accessKey)
  positions!: Position[];

  @OneToMany(() => SalesTerritory, (salesTerritory) => salesTerritory.accessKey)
  salesTerritories!: SalesTerritory[];
}
