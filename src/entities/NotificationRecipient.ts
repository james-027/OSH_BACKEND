import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Notification } from "./Notification";
import { User } from "./User";

@Entity("notification_recipients")
@Index("idx_notif_recipients_user_unread", ["user_id", "is_read", "created_at"])
@Index("idx_notif_recipients_notif_user", ["notification_id", "user_id"])
export class NotificationRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  notification_id: number;

  @ManyToOne(() => Notification, (notif) => notif.recipients, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "notification_id" })
  notification: Notification;

  @Column()
  user_id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ default: false })
  is_read: boolean;

  @Column({ type: "timestamp", nullable: true })
  read_at: Date | null;

  @Column({ default: false })
  is_dismissed: boolean;

  @CreateDateColumn({
    type: "timestamp",
    precision: 6,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at: Date;
}

