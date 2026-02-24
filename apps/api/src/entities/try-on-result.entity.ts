import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { TryOnRequest } from './try-on-request.entity';

@Entity('try_on_results')
export class TryOnResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  request_id: string;

  @Column()
  result_image_url: string;

  @Column('decimal', { precision: 5, scale: 2 })
  fit_probability: number;

  @Column('jsonb', { nullable: true })
  fit_breakdown_json: Record<string, number> | null;

  @Column()
  model_version: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => TryOnRequest, (r) => r.result)
  @JoinColumn({ name: 'request_id' })
  request: TryOnRequest;
}
