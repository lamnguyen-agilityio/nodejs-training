/**
 * the pagination parameters for a request
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * the resolved pagination parameters for a request
 */
export interface ResolvedPagination {
  page: number;
  limit: number;
  offset: number;
}
