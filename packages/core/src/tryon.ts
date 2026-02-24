export type GarmentCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes';

export type ClothingSize =
  | 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

export interface TryOnRequestDto {
  id: string;
  user_id: string;
  mannequin_version_id: string;
  garment_image_url: string;
  category: GarmentCategory;
  selected_size: ClothingSize;
  created_at: string;
}

export interface CreateTryOnRequestDto {
  garment_image: string; // base64 or URL
  category: GarmentCategory;
  selected_size: ClothingSize;
  mannequin_version_id: string;
}

export interface FitBreakdown {
  shoulders?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  length?: number;
  sleeves?: number;
}

export interface TryOnResultDto {
  id: string;
  request_id: string;
  result_image_url: string;
  fit_probability: number;
  fit_breakdown_json?: FitBreakdown | null;
  model_version: string;
  created_at: string;
}

export interface TryOnHistoryItemDto {
  request: TryOnRequestDto;
  result: TryOnResultDto;
}
