import { NUMERIC } from '@/common/constants';
import { PaginationParams, ResolvedPagination } from '@/common/interfaces';

const { PAGE_MIN, LIMIT_DEFAULT } = NUMERIC;

/**
 * resolves pagination parameters from the DTO and returns a resolved pagination object.
 */
export const resolvePagination = (dto: PaginationParams): ResolvedPagination => {
  const page = dto.page ?? PAGE_MIN;
  const limit = dto.limit ?? LIMIT_DEFAULT;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};
