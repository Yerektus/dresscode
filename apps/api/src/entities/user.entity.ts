import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { BodyProfile } from './body-profile.entity';
import { MannequinVersion } from './mannequin-version.entity';
import { TryOnRequest } from './try-on-request.entity';
import { Subscription } from './subscription.entity';
import { CreditPurchase } from './credit-purchase.entity';
import { EmailVerificationToken } from './email-verification-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  pending_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => BodyProfile, (bp) => bp.user)
  body_profile: BodyProfile;

  @OneToMany(() => MannequinVersion, (mv) => mv.user)
  mannequin_versions: MannequinVersion[];

  @OneToMany(() => TryOnRequest, (tr) => tr.user)
  try_on_requests: TryOnRequest[];

  @OneToOne(() => Subscription, (s) => s.user)
  subscription: Subscription;

  @OneToMany(() => CreditPurchase, (purchase) => purchase.user)
  credit_purchases: CreditPurchase[];

  @OneToMany(() => EmailVerificationToken, (token) => token.user)
  email_verification_tokens: EmailVerificationToken[];
}
