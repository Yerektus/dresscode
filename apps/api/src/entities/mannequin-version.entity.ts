import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('mannequin_versions')
export class MannequinVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('jsonb')
  snapshot_json: Record<string, unknown>;

  @Column()
  front_image_url: string;

  @Column({ nullable: true })
  side_image_url: string | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (u) => u.mannequin_versions)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
