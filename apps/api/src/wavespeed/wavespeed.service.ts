import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parsePositiveInt } from '../common/image-input.utils';
import { WaveSpeedApiEnvelope, WaveSpeedPredictionData } from './wavespeed.types';

@Injectable()
export class WaveSpeedService {
  private readonly apiBaseUrl =
    process.env.WAVESPEED_API_BASE_URL ?? 'https://api.wavespeed.ai/api/v3';
  private readonly pollIntervalMs = parsePositiveInt(
    process.env.WAVESPEED_POLL_INTERVAL_MS,
    1500,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.WAVESPEED_TIMEOUT_MS,
    90000,
  );

  async request<T>(url: string, init: RequestInit): Promise<T> {
    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('WAVESPEED_API_KEY is not configured');
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const rawBody = await response.text();
    const parsedBody = this.tryParseJson(rawBody);

    if (!response.ok) {
      const message = this.extractErrorMessage(parsedBody) ?? `HTTP ${response.status}`;
      const code = this.extractErrorCode(parsedBody);
      const withCode = code !== null ? `[code ${code}] ${message}` : message;
      throw new ServiceUnavailableException(`WaveSpeed request failed: ${withCode}`);
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      throw new ServiceUnavailableException('WaveSpeed returned invalid JSON');
    }

    return parsedBody as T;
  }

  normalizePrediction(payload: WaveSpeedApiEnvelope<WaveSpeedPredictionData>): WaveSpeedPredictionData {
    const root = this.asRecord(payload);
    const nestedData = this.asRecord(root?.data);
    const source = nestedData ?? root ?? {};

    const status = this.asString(source.status) ?? this.asString(root?.status) ?? undefined;
    const outputs = source.outputs ?? source.output ?? root?.outputs ?? root?.output;
    const error = source.error ?? source.message ?? root?.error ?? root?.message;
    const message = source.message ?? root?.message;

    return {
      ...source,
      id: this.asString(source.id) ?? this.asString(root?.id) ?? undefined,
      status,
      outputs,
      urls: source.urls ?? root?.urls,
      error,
      message,
    };
  }

  extractImageUrl(data: unknown): string | null {
    if (typeof data === 'string') {
      return this.normalizeImageReference(data);
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const nestedUrl = this.extractImageUrl(item);
        if (nestedUrl) {
          return nestedUrl;
        }
      }
      return null;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const directCandidates = [
      record.url,
      record.download_url,
      record.image_url,
      record.result_image_url,
      record.output_url,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate) {
        const normalized = this.normalizeImageReference(candidate);
        if (normalized) {
          return normalized;
        }
      }
    }

    const nestedCandidates = [record.images, record.output, record.results, record.data];
    for (const nestedCandidate of nestedCandidates) {
      const nestedUrl = this.extractImageUrl(nestedCandidate);
      if (nestedUrl) {
        return nestedUrl;
      }
    }

    return null;
  }

  isCompletedStatus(status: string | undefined): boolean {
    const normalized = (status ?? '').toLowerCase();
    return normalized === 'completed' || normalized === 'success' || normalized === 'succeeded';
  }

  isFailedStatus(status: string | undefined, error: unknown): boolean {
    const normalized = (status ?? '').toLowerCase();
    if (
      normalized === 'failed' ||
      normalized === 'error' ||
      normalized === 'cancelled' ||
      normalized === 'canceled'
    ) {
      return true;
    }

    return !normalized && Boolean(error);
  }

  resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }

    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.apiBaseUrl}${normalizedPath}`;
  }

  async submitAndPoll(
    modelUrl: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
    pollIntervalMs?: number,
  ): Promise<WaveSpeedPredictionData> {
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    const effectivePollInterval = pollIntervalMs ?? this.pollIntervalMs;

    const submitPayload = await this.request<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
      this.resolveUrl(modelUrl),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    const submission = this.normalizePrediction(submitPayload);

    if (this.isCompletedStatus(submission.status)) {
      return submission;
    }

    if (this.isFailedStatus(submission.status, submission.error ?? submission.message)) {
      throw new ServiceUnavailableException(
        `WaveSpeed failed: ${this.stringifyUnknown(submission.error ?? submission.message)}`,
      );
    }

    if (!submission.id) {
      throw new ServiceUnavailableException('WaveSpeed did not return task id');
    }

    const deadline = Date.now() + effectiveTimeout;
    while (Date.now() < deadline) {
      await this.sleep(effectivePollInterval);

      const resultPayload = await this.request<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
        this.resolveUrl(`/predictions/${submission.id}/result`),
        { method: 'GET' },
      );

      const result = this.normalizePrediction(resultPayload);

      if (this.isCompletedStatus(result.status)) {
        return result;
      }

      if (this.isFailedStatus(result.status, result.error ?? result.message)) {
        throw new ServiceUnavailableException(
          `WaveSpeed failed: ${this.stringifyUnknown(result.error ?? result.message)}`,
        );
      }
    }

    throw new ServiceUnavailableException('WaveSpeed generation timed out');
  }

  buildModelPathCandidates(
    primaryPath: string | undefined,
    fallbackPaths: string | undefined,
    defaults?: string[],
  ): string[] {
    const envCandidates = [primaryPath, ...(fallbackPaths?.split(',') ?? [])].flatMap((value) =>
      this.expandModelPathCandidate(value),
    );
    const allCandidates = [...envCandidates, ...(defaults ?? [])];
    const uniqueCandidates: string[] = [];

    for (const candidate of allCandidates.map((value) => this.normalizeModelPathCandidate(value))) {
      if (!candidate) {
        continue;
      }

      if (!uniqueCandidates.includes(candidate)) {
        uniqueCandidates.push(candidate);
      }
    }

    return uniqueCandidates;
  }

  normalizeModelPathCandidate(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    let normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        normalized = new URL(normalized).pathname;
      } catch {
        return normalized;
      }
    }

    normalized = normalized
      .replace(/^\/api\/v\d+\//, '/')
      .replace(/^api\/v\d+\//, '')
      .replace(/^\/+/, '');

    return normalized || null;
  }

  isModelMissingError(error: unknown): boolean {
    const message = this.extractErrorText(error).toLowerCase();
    return (
      message.includes('product not found') ||
      message.includes('model not found') ||
      message.includes('[code 1405]') ||
      message.includes('code 1405')
    );
  }

  isPayloadSchemaError(error: unknown): boolean {
    const message = this.extractErrorText(error).toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('missing')
    );
  }

  isInputImageFetchError(error: unknown): boolean {
    const message = this.extractErrorText(error).toLowerCase();
    return (
      message.includes('cannot fetch content from the provided url') ||
      message.includes('url is valid and accessible')
    );
  }

  extractErrorText(error: unknown): string {
    if (error instanceof ServiceUnavailableException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object') {
        const responseMessage = (response as Record<string, unknown>).message;
        if (typeof responseMessage === 'string') {
          return responseMessage;
        }

        if (Array.isArray(responseMessage) && responseMessage.length > 0) {
          return responseMessage.map((item) => this.stringifyUnknown(item)).join(', ');
        }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return this.stringifyUnknown(error);
  }

  extractErrorMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const message = record.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.map((item) => this.stringifyUnknown(item)).join(', ');
    }

    const error = record.error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    if (error && typeof error === 'object') {
      const nested = this.extractErrorMessage(error);
      if (nested) {
        return nested;
      }
    }

    const data = record.data;
    if (data && typeof data === 'object') {
      const nested = this.extractErrorMessage(data);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  tryParseJson(payload: string): unknown {
    if (!payload.trim()) {
      return null;
    }

    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    return null;
  }

  stringifyUnknown(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private expandModelPathCandidate(value: string | undefined): string[] {
    const normalized = this.normalizeModelPathCandidate(value);
    if (!normalized) {
      return [];
    }

    const candidates = [normalized];
    if (normalized.endsWith('/text-to-image')) {
      const withoutTaskSuffix = normalized.slice(0, -'/text-to-image'.length);
      if (withoutTaskSuffix) {
        candidates.push(withoutTaskSuffix);
      }
    }

    return candidates;
  }

  private extractErrorCode(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const code = Number.parseInt(String(record.code ?? ''), 10);
    if (Number.isFinite(code)) {
      return code;
    }

    const nestedCandidates = [record.error, record.data];
    for (const nested of nestedCandidates) {
      const nestedCode = this.extractErrorCode(nested);
      if (nestedCode !== null) {
        return nestedCode;
      }
    }

    return null;
  }

  private normalizeImageReference(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          return parsed.toString();
        }
      } catch {
        return null;
      }
    }

    return null;
  }
}
