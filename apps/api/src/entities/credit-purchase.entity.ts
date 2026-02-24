import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('credit_purchases')
export class CreditPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  external_payment_id: string;

  @Column({ type: 'varchar' })
  package_code: string;

  @Column({ type: 'int' })
  credits_amount: number;

  @Column({ type: 'int' })
  amount_usd_cents: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.credit_purchases)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
