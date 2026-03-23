// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

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
