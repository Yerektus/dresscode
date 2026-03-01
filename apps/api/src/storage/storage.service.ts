import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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

type CommandCtor = new (input: Record<string, unknown>) => unknown;
type SignedUrlFn = (
  client: unknown,
  command: unknown,
  options: { expiresIn: number },
) => Promise<string>;

interface S3SdkBundle {
  S3Client: new (config: Record<string, unknown>) => unknown;
  PutObjectCommand: CommandCtor;
  GetObjectCommand: CommandCtor;
  getSignedUrl: SignedUrlFn;
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
  private readonly client: unknown;
  private readonly putObjectCommandCtor: CommandCtor | null;
  private readonly getObjectCommandCtor: CommandCtor | null;
  private readonly getSignedUrlFn: SignedUrlFn | null;

  constructor() {
    const sdkBundle = this.resolveS3SdkBundle();
    if (!sdkBundle) {
      this.client = null;
      this.putObjectCommandCtor = null;
      this.getObjectCommandCtor = null;
      this.getSignedUrlFn = null;
      return;
    }

    this.putObjectCommandCtor = sdkBundle.PutObjectCommand;
    this.getObjectCommandCtor = sdkBundle.GetObjectCommand;
    this.getSignedUrlFn = sdkBundle.getSignedUrl;

    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    this.client = new sdkBundle.S3Client({
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
    const client = this.client;
    const putObjectCommandCtor = this.putObjectCommandCtor;
    const getSignedUrlFn = this.getSignedUrlFn;
    if (!client || !putObjectCommandCtor || !getSignedUrlFn) {
      throw new ServiceUnavailableException('S3 SDK packages are not installed. Run npm install.');
    }

    const command = new putObjectCommandCtor({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrlFn(client, command, {
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

  async getObjectAsDataUri(assetKey: string): Promise<string> {
    const normalized = this.validateAssetKey(assetKey);
    this.assertReady();
    const client = this.client as { send(cmd: unknown): Promise<{ Body?: { transformToByteArray(): Promise<Uint8Array>; ContentType?: string } & Record<string, unknown> }> };
    const getObjectCommandCtor = this.getObjectCommandCtor;
    if (!client || !getObjectCommandCtor) {
      throw new ServiceUnavailableException('S3 SDK packages are not installed. Run npm install.');
    }

    const command = new getObjectCommandCtor({ Bucket: this.bucket, Key: normalized });
    const response = await client.send(command);
    const body = response?.Body;
    if (!body || typeof (body as { transformToByteArray?: unknown }).transformToByteArray !== 'function') {
      throw new ServiceUnavailableException('Failed to read object from storage');
    }

    const bytes = await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    const contentType = (body as { ContentType?: string }).ContentType ?? 'image/jpeg';
    const base64 = Buffer.from(bytes).toString('base64');
    return `data:${contentType};base64,${base64}`;
  }

  async createSignedReadUrl(assetKey: string): Promise<string> {
    const normalized = this.validateAssetKey(assetKey);
    this.assertReady();
    const client = this.client;
    const getObjectCommandCtor = this.getObjectCommandCtor;
    const getSignedUrlFn = this.getSignedUrlFn;
    if (!client || !getObjectCommandCtor || !getSignedUrlFn) {
      throw new ServiceUnavailableException('S3 SDK packages are not installed. Run npm install.');
    }

    const command = new getObjectCommandCtor({
      Bucket: this.bucket,
      Key: normalized,
    });

    return getSignedUrlFn(client, command, {
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
    if (
      !this.client ||
      !this.putObjectCommandCtor ||
      !this.getObjectCommandCtor ||
      !this.getSignedUrlFn
    ) {
      throw new ServiceUnavailableException(
        'S3 SDK packages are not installed. Run npm install.',
      );
    }
  }

  private resolveS3SdkBundle(): S3SdkBundle | null {
    try {
      const s3Module = require('@aws-sdk/client-s3') as {
        S3Client?: new (config: Record<string, unknown>) => unknown;
        PutObjectCommand?: CommandCtor;
        GetObjectCommand?: CommandCtor;
      };
      const presignerModule = require('@aws-sdk/s3-request-presigner') as {
        getSignedUrl?: SignedUrlFn;
      };

      if (
        !s3Module.S3Client ||
        !s3Module.PutObjectCommand ||
        !s3Module.GetObjectCommand ||
        !presignerModule.getSignedUrl
      ) {
        return null;
      }

      return {
        S3Client: s3Module.S3Client,
        PutObjectCommand: s3Module.PutObjectCommand,
        GetObjectCommand: s3Module.GetObjectCommand,
        getSignedUrl: presignerModule.getSignedUrl,
      };
    } catch {
      return null;
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
