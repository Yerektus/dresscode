export const MEDIA_UPLOAD_PURPOSES = ['face_image', 'garment_image'] as const;

export type MediaUploadPurpose = (typeof MEDIA_UPLOAD_PURPOSES)[number];

export const ASSET_REFERENCE_PREFIX = 'asset:';
