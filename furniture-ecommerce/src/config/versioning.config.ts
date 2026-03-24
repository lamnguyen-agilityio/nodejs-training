import type { VersioningOptions } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';

import { API } from '@/constants';

/*
 * versioning configuration for the application.
 * URI versioning (/api/v1/...)
 */
export const versioningConfig = (): VersioningOptions => ({
  type: VersioningType.URI,
  defaultVersion: API.VERSION.DEFAULT,
  prefix: `${API.PREFIX}/${API.VERSION.PREFIX}`,
});
