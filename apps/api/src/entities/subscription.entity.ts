import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ default: 'webkassa' })
  provider: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  current_period_end: Date | null;

  @Column({ nullable: true })
  external_payment_id: string | null;

  @Column({ default: 'free' })
  plan_code: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => User, (u) => u.subscription)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
