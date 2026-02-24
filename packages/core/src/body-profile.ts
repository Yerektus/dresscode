export type BodyShape = 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted_triangle';

export interface BodyProfileDto {
  id: string;
  user_id: string;
  height_cm: number;
  weight_kg: number;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  sleeve_cm?: number | null;
  inseam_cm?: number | null;
  body_shape?: BodyShape | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBodyProfileDto {
  height_cm: number;
  weight_kg: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  sleeve_cm?: number;
  inseam_cm?: number;
  body_shape?: BodyShape;
}

export interface UpdateBodyProfileDto extends Partial<CreateBodyProfileDto> {}
