export interface MannequinVersionDto {
  id: string;
  user_id: string;
  snapshot_json: Record<string, unknown>;
  front_image_url: string;
  side_image_url?: string | null;
  is_active: boolean;
  created_at: string;
}
