/**
 * file upload constraints used across upload validators.
 */
export const FILE_UPLOAD = {
  /** maximum image size in bytes — 5 MB */
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_IMAGE_SIZE_LABEL: '5MB',

  /** allowed image mime types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  ALLOWED_IMAGE_TYPES_LABEL: 'JPEG, PNG, WEBP',
} as const;
