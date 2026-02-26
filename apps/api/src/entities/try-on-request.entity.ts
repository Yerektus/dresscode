import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { MannequinVersion } from './mannequin-version.entity';
import { TryOnResult } from './try-on-result.entity';

@Entity('try_on_requests')
export class TryOnRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('uuid')
  mannequin_version_id: string;

  @Column()
  garment_image_url: string;

  @Column()
  category: string;

  @Column()
  selected_size: string;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  chest_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  waist_cm: number | null;

  @Column('decimal', { precision: 5, scale: 1, nullable: true })
  hips_cm: number | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (u) => u.try_on_requests)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => MannequinVersion)
  @JoinColumn({ name: 'mannequin_version_id' })
  mannequin_version: MannequinVersion;

  @OneToOne(() => TryOnResult, (r) => r.request)
  result: TryOnResult;
}
