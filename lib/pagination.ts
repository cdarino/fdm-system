export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationRange {
  page: number;
  limit: number;
  from: number;
  to: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getPaginationOffsets(params?: PaginationParams, defaultLimit = 10): PaginationRange {
  const page = Math.max(1, params?.page ?? 1);
  const limit = params?.limit && params.limit > 0 ? params.limit : defaultLimit;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, from, to };
}

export function buildPaginatedResult<T>(
  data: T[],
  totalCount: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    data,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}
