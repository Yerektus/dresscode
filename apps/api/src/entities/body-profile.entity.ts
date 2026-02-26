import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('body_profiles')
export class BodyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('decimal', { precision: 5, scale: 1 })
  height_cm: number;

  @Column('decimal', { precision: 5, scale: 1 })
  weight_kg: number;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  chest_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  waist_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  hips_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  sleeve_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  inseam_cm: number | null;

  @Column({ type: 'varchar', nullable: true })
  body_shape: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'text', nullable: true })
  face_image: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => User, (u) => u.body_profile)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
