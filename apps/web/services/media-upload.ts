import type * as ImagePicker from 'expo-image-picker';
import * as api from '@/services/api';

function inferMimeType(asset: ImagePicker.ImagePickerAsset): string {
  const explicitMimeType = asset.mimeType?.toLowerCase();
  if (explicitMimeType) {
    return explicitMimeType;
  }

  const source = `${asset.fileName ?? ''} ${asset.uri}`.toLowerCase();
  if (source.includes('.png')) {
    return 'image/png';
  }
  if (source.includes('.webp')) {
    return 'image/webp';
  }
  if (source.includes('.heic')) {
    return 'image/heic';
  }
  if (source.includes('.heif')) {
    return 'image/heif';
  }

  return 'image/jpeg';
}

async function resolveAssetBlob(asset: ImagePicker.ImagePickerAsset): Promise<Blob> {
  if (!asset.uri) {
    throw new Error('Image URI is missing');
  }

  const fileResponse = await fetch(asset.uri);
  if (!fileResponse.ok) {
    throw new Error('Failed to read selected image');
  }

  const fileBlob = await fileResponse.blob();
  if (!fileBlob.size) {
    throw new Error('Selected image is empty');
  }

  return fileBlob;
}

export async function uploadImageAssetWithPresign(
  asset: ImagePicker.ImagePickerAsset,
  purpose: api.MediaUploadPurpose,
): Promise<string> {
  const contentType = inferMimeType(asset);
  const fileBlob = await resolveAssetBlob(asset);
  const sizeBytes = typeof asset.fileSize === 'number' && asset.fileSize > 0 ? asset.fileSize : fileBlob.size;

  const presign = await api.createPresignedUpload({
    purpose,
    content_type: contentType,
    size_bytes: sizeBytes,
  });

  const uploadHeaders: Record<string, string> = {
    ...presign.required_headers,
  };
  const hasContentTypeHeader = Object.keys(uploadHeaders).some(
    (header) => header.toLowerCase() === 'content-type',
  );
  if (!hasContentTypeHeader) {
    uploadHeaders['Content-Type'] = contentType;
  }

  const uploadResponse = await fetch(presign.upload_url, {
    method: 'PUT',
    headers: uploadHeaders,
    body: fileBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }

  return presign.asset_key;
}
