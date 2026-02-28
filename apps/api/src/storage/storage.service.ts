import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ASSET_REFERENCE_PREFIX, type MediaUploadPurpose } from './storage.constants';

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const ASSET_KEY_PATTERN = /^users\/([0-9a-fA-F-]{36})\/(face_image|garment_image)\/([A-Za-z0-9._-]{1,180})$/;

interface PresignedUploadInput {
  userId: string;
  purpose: MediaUploadPurpose;
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET ?? '';
  private readonly region = process.env.S3_REGION ?? 'us-east-1';
  private readonly endpoint = process.env.S3_ENDPOINT?.trim() || null;
  private readonly forcePathStyle = this.parseBoolean(process.env.S3_FORCE_PATH_STYLE, true);
  private readonly signedUrlTtlSeconds = this.parsePositiveInt(
    process.env.S3_SIGNED_URL_TTL_SECONDS,
    300,
  );
  private readonly maxFaceBytes = this.parsePositiveInt(process.env.UPLOAD_MAX_FACE_BYTES, 25 * 1024 * 1024);
  private readonly maxGarmentBytes = this.parsePositiveInt(process.env.UPLOAD_MAX_GARMENT_BYTES, 25 * 1024 * 1024);
  private readonly client: S3Client;

  constructor() {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint ?? undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async createPresignedUpload(input: PresignedUploadInput) {
    const { userId, purpose } = input;
    const contentType = this.normalizeContentType(input.contentType);
    this.validateUploadSize(purpose, input.sizeBytes);

    const extension = CONTENT_TYPE_EXTENSION[contentType];
    if (!extension) {
      throw new BadRequestException('Unsupported content_type');
    }

    const key = `users/${userId}/${purpose}/${randomUUID()}.${extension}`;
    this.assertReady();

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlTtlSeconds,
    });

    return {
      upload_url: uploadUrl,
      asset_key: key,
      asset_url: this.buildAssetUrl(key),
      expires_at: new Date(Date.now() + this.signedUrlTtlSeconds * 1000).toISOString(),
      required_headers: {
        'Content-Type': contentType,
      } as Record<string, string>,
    };
  }

  async createSignedReadUrl(assetKey: string): Promise<string> {
    const normalized = this.validateAssetKey(assetKey);
    this.assertReady();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: normalized,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlTtlSeconds,
    });
  }

  validateAssetKey(
    assetKey: string,
    expectedUserId?: string,
    expectedPurpose?: MediaUploadPurpose,
  ): string {
    const normalized = assetKey.trim();
    if (!normalized) {
      throw new BadRequestException('asset key is required');
    }

    const match = normalized.match(ASSET_KEY_PATTERN);
    if (!match) {
      throw new BadRequestException('asset key has invalid format');
    }

    const [, userId, purpose] = match;
    if (expectedUserId && userId !== expectedUserId) {
      throw new BadRequestException('asset key user mismatch');
    }
    if (expectedPurpose && purpose !== expectedPurpose) {
      throw new BadRequestException('asset key purpose mismatch');
    }

    return normalized;
  }

  toStoredAssetReference(assetKey: string): string {
    return `${ASSET_REFERENCE_PREFIX}${assetKey}`;
  }

  extractAssetKeyFromReference(reference: string | null | undefined): string | null {
    if (!reference) {
      return null;
    }

    const trimmed = reference.trim();
    if (!trimmed.startsWith(ASSET_REFERENCE_PREFIX)) {
      return null;
    }

    const raw = trimmed.slice(ASSET_REFERENCE_PREFIX.length).trim();
    return raw || null;
  }

  private normalizeContentType(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('content_type is required');
    }

    return normalized;
  }

  private validateUploadSize(purpose: MediaUploadPurpose, sizeBytes: number) {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('size_bytes must be a positive number');
    }

    const maxBytes = purpose === 'face_image' ? this.maxFaceBytes : this.maxGarmentBytes;
    if (sizeBytes > maxBytes) {
      throw new BadRequestException(`Payload too large for ${purpose}`);
    }
  }

  private buildAssetUrl(assetKey: string): string {
    if (!this.endpoint) {
      return `s3://${this.bucket}/${assetKey}`;
    }

    const endpoint = this.endpoint.endsWith('/')
      ? this.endpoint.slice(0, -1)
      : this.endpoint;

    if (this.forcePathStyle) {
      return `${endpoint}/${this.bucket}/${assetKey}`;
    }

    return `${endpoint}/${assetKey}`;
  }

  private assertReady() {
    if (!this.bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is not configured');
    }
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private parseBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (!raw) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }

    return fallback;
  }
}
