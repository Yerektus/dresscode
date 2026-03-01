export interface WaveSpeedApiEnvelope<T = unknown> {
  code?: number;
  message?: unknown;
  data?: T;
  [key: string]: unknown;
}

export interface WaveSpeedPredictionData {
  id?: string;
  status?: string;
  outputs?: unknown;
  urls?: unknown;
  error?: unknown;
  message?: unknown;
  [key: string]: unknown;
}
