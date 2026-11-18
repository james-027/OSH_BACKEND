import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Role } from "./Role";
import { Module } from "./Module";
import { RoleActionPreset } from "./RoleActionPreset";
import { LocationType } from "./LocationType";
import { Location } from "./Location";
import { RoleLocationPreset } from "./RoleLocationPreset";
import { RoleWarehousePreset } from "./RoleWarehousePreset";
import { Company } from "./Company";
import { AccessKey } from "./AccessKey";
import { Theme } from "./Theme";
import { Status } from "./Status";
import { UserPermissions } from "./UserPermissions";
import { UserLocations } from "./UserLocations";
import { UserWarehouses } from "./UserWarehouses";
import { UserLoginSession } from "./UserLoginSession";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  user_name!: string;
  @Column()
  first_name!: string;

  @Column({ type: "varchar", nullable: true })
  middle_name!: string | null;

  @Column()
  last_name!: string;

  @Column()
  role_id!: number;

  @Column({ type: "varchar", nullable: true })
  emp_number!: string | null;

  @Column({ type: "varchar", nullable: true, unique: true })
  email!: string | null;

  @Column({ type: "varchar" })
  password!: string;

  @Column({ default: true })
  user_reset!: boolean;

  @Column({ nullable: true })
  user_upline_id!: number | null;

  @Column({ default: true })
  email_switch!: boolean;

  @Column()
  status_id!: number;

  @Column()
  theme_id!: number;

  @Column({ type: "varchar", nullable: true })
  profile_pic_url!: string | null;

  @Column({ type: "varchar", nullable: true })
  signature_url!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @Column()
  created_by!: number;

  @Column({ nullable: true })
  updated_by!: number | null;
  @UpdateDateColumn()
  modified_at!: Date;

  @Column({ type: "int", nullable: true })
  current_access_key!: number | null;

  // Relationships
  @ManyToOne(() => Role, (role) => role.users, { eager: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => User, (user) => user.subordinates, { eager: false })
  @JoinColumn({ name: "user_upline_id" })
  userUpline!: User | null;

  @OneToMany(() => User, (user) => user.userUpline)
  subordinates!: User[];

  @ManyToOne(() => Status, (status) => status.users, { eager: false })
  @JoinColumn({ name: "status_id" })
  status!: Status;

  @ManyToOne(() => Theme, (theme) => theme.users, { eager: false })
  @JoinColumn({ name: "theme_id" })
  theme!: Theme;

  @ManyToOne(() => User, (user) => user.createdUsers, { eager: false })
  @JoinColumn({ name: "created_by" })
  createdBy!: User;

  @OneToMany(() => User, (user) => user.createdBy)
  createdUsers!: User[];

  @ManyToOne(() => User, (user) => user.updatedUsers, { eager: false })
  @JoinColumn({ name: "updated_by" })
  updatedBy!: User | null;

  @OneToMany(() => User, (user) => user.updatedBy)
  updatedUsers!: User[];

  @OneToMany(() => Role, (role) => role.createdBy)
  createdRoles!: Role[];

  @OneToMany(() => Role, (role) => role.updatedBy)
  updatedRoles!: Role[];

  @OneToMany(() => Module, (module) => module.createdBy)
  createdModules!: Module[];

  @OneToMany(() => Module, (module) => module.updatedBy)
  updatedModules!: Module[];

  @OneToMany(() => RoleActionPreset, (preset) => preset.createdBy)
  createdRoleActionPresets!: RoleActionPreset[];

  @OneToMany(() => RoleActionPreset, (preset) => preset.updatedBy)
  updatedRoleActionPresets!: RoleActionPreset[];

  @OneToMany(() => LocationType, (locationType) => locationType.createdBy)
  createdLocationTypes!: LocationType[];

  @OneToMany(() => LocationType, (locationType) => locationType.updatedBy)
  updatedLocationTypes!: LocationType[];

  @OneToMany(() => Location, (location) => location.createdBy)
  createdLocations!: Location[];

  @OneToMany(() => Location, (location) => location.updatedBy)
  updatedLocations!: Location[];

  @OneToMany(() => RoleLocationPreset, (preset) => preset.createdBy)
  createdRoleLocationPresets!: RoleLocationPreset[];

  @OneToMany(() => RoleLocationPreset, (preset) => preset.updatedBy)
  updatedRoleLocationPresets!: RoleLocationPreset[];

  @OneToMany(() => RoleWarehousePreset, (preset) => preset.createdBy)
  createdRoleWarehousePresets!: RoleWarehousePreset[];

  @OneToMany(() => RoleWarehousePreset, (preset) => preset.updatedBy)
  updatedRoleWarehousePresets!: RoleWarehousePreset[];

  @OneToMany(() => Company, (company) => company.createdBy)
  createdCompanies!: Company[];

  @OneToMany(() => Company, (company) => company.updatedBy)
  updatedCompanies!: Company[];

  @OneToMany(() => AccessKey, (accessKey) => accessKey.createdBy)
  createdAccessKeys!: AccessKey[];

  @OneToMany(() => AccessKey, (accessKey) => accessKey.updatedBy)
  updatedAccessKeys!: AccessKey[];

  @OneToMany(() => Theme, (theme) => theme.createdBy)
  createdThemes!: Theme[];

  @OneToMany(() => Theme, (theme) => theme.updatedBy)
  updatedThemes!: Theme[];

  @OneToMany(() => UserPermissions, (userPermissions) => userPermissions.user)
  userPermissions!: UserPermissions[];

  @OneToMany(
    () => UserPermissions,
    (userPermissions) => userPermissions.createdBy
  )
  createdUserPermissions!: UserPermissions[];

  @OneToMany(
    () => UserPermissions,
    (userPermissions) => userPermissions.updatedBy
  )
  updatedUserPermissions!: UserPermissions[];

  @OneToMany(() => UserLocations, (userLocations) => userLocations.user)
  userLocations!: UserLocations[];
  @OneToMany(() => UserLocations, (userLocations) => userLocations.createdBy)
  createdUserLocations!: UserLocations[];

  @OneToMany(() => UserLocations, (userLocations) => userLocations.updatedBy)
  updatedUserLocations!: UserLocations[];

  @OneToMany(() => UserWarehouses, (userWarehouses) => userWarehouses.user)
  userWarehouses!: UserWarehouses[];

  @OneToMany(
    () => UserWarehouses,
    (userWarehouses) => userWarehouses.createdBy,
  )
  createdUserWarehouses!: UserWarehouses[];

  @OneToMany(
    () => UserWarehouses,
    (userWarehouses) => userWarehouses.updatedBy,
  )
  updatedUserWarehouses!: UserWarehouses[];
  @ManyToOne(() => AccessKey, (accessKey) => accessKey.currentUsers, {
    eager: false,
  })
  @JoinColumn({ name: "current_access_key" })
  currentAccessKey!: AccessKey | null;

  @OneToMany(() => UserLoginSession, (session) => session.user)
  loginSessions!: UserLoginSession[];
}
