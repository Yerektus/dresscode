import { BadRequestException } from '@nestjs/common';
import { estimateDataUriBytes, isDataUri } from '../storage/data-uri';

export function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function assertLegacyDataUriSize(value: string, fieldName: string, maxBytes: number) {
  const bytes = estimateDataUriBytes(value);
  if (bytes === null) {
    throw new BadRequestException(`${fieldName} must be a valid base64 Data URI`);
  }
  if (bytes > maxBytes) {
    throw new BadRequestException(
      `${fieldName} exceeds legacy Data URI size limit (${maxBytes} bytes)`,
    );
  }
}

export function normalizeWaveSpeedImageInput(
  value: string,
  fieldName: string,
  maxBytes: number,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  if (isDataUri(trimmed)) {
    assertLegacyDataUriSize(trimmed, fieldName, maxBytes);
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Fall through to validation error below.
  }

  throw new BadRequestException(`${fieldName} must be a valid HTTPS URL or a Data URI`);
}
