// ---------------------------------------------------------------------------
// Shared API types — mirror the shape returned by all backend services.
// ---------------------------------------------------------------------------

/** Standard envelope wrapping every non-paginated API response. */
export interface ApiResponse<T> {
  data: T;
  /** ISO-8601 timestamp of when the response was generated. */
  timestamp: string;
  /** Correlation ID echoed from the X-Request-ID request header. */
  request_id: string;
}

/** Standard envelope for list endpoints. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  /** ISO-8601 timestamp of when the response was generated. */
  timestamp: string;
  /** Correlation ID echoed from the X-Request-ID request header. */
  request_id: string;
}

/** Standard error envelope returned by all services on 4xx / 5xx. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Field-level validation errors, keyed by field path. */
    details?: Record<string, string[]>;
  };
  timestamp: string;
  request_id: string;
}
