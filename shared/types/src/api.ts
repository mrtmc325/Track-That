/** Describes a failed API operation with a machine-readable code. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Standard envelope for every API response. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

/** Extends ApiResponse with cursor/page metadata for list endpoints. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
