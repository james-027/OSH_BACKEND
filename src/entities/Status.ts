import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Role } from "./Role";
import { Module } from "./Module";
import { Action } from "./Action";
import { RoleActionPreset } from "./RoleActionPreset";
import { LocationType } from "./LocationType";
import { Location } from "./Location";
import { RoleLocationPreset } from "./RoleLocationPreset";
import { RoleWarehousePreset } from "./RoleWarehousePreset";
import { Company } from "./Company";
import { AccessKey } from "./AccessKey";
import { Theme } from "./Theme";
import { User } from "./User";
import { UserPermissions } from "./UserPermissions";
import { UserLocations } from "./UserLocations";
import { UserWarehouses } from "./UserWarehouses";

@Entity()
export class Status {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  status_name!: string;

  @OneToMany(() => Role, (role) => role.status)
  roles!: Role[];

  @OneToMany(() => Module, (module) => module.status)
  modules!: Module[];

  @OneToMany(() => Action, (action) => action.status)
  actions!: Action[];

  @OneToMany(() => RoleActionPreset, (preset) => preset.status)
  roleActionPresets!: RoleActionPreset[];

  @OneToMany(() => LocationType, (locationType) => locationType.status)
  locationTypes!: LocationType[];

  @OneToMany(() => Location, (location) => location.status)
  locations!: Location[];

  // Relationship for status_id in RoleLocationPreset
  @OneToMany(() => RoleLocationPreset, (preset) => preset.status)
  roleLocationPresets!: RoleLocationPreset[];

  // Relationship for status_id in RoleWarehousePreset
  @OneToMany(() => RoleWarehousePreset, (preset) => preset.status)
  roleWarehousePresets!: RoleWarehousePreset[];

  // Relationship for status_id in Company
  @OneToMany(() => Company, (company) => company.status)
  companies!: Company[];

  // Relationship for status_id in AccessKey
  @OneToMany(() => AccessKey, (accessKey) => accessKey.status)
  accessKeys!: AccessKey[];

  // Relationship for status_id in Theme
  @OneToMany(() => Theme, (theme) => theme.status)
  themes!: Theme[];

  // Relationship for status_id in User
  @OneToMany(() => User, (user) => user.status)
  users!: User[];

  // Relationship for status_id in UserPermissions
  @OneToMany(() => UserPermissions, (userPermissions) => userPermissions.status)
  userPermissions!: UserPermissions[];

  // Relationship for status_id in UserLocations
  @OneToMany(() => UserLocations, (userLocations) => userLocations.status)
  userLocations!: UserLocations[];

  // Relationship for status_id in UserWarehouses
  @OneToMany(() => UserWarehouses, (userWarehouses) => userWarehouses.status)
  userWarehouses!: UserWarehouses[];
}
