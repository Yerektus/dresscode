import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { BodyProfile } from './body-profile.entity';
import { MannequinVersion } from './mannequin-version.entity';
import { TryOnRequest } from './try-on-request.entity';
import { Subscription } from './subscription.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

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
}
