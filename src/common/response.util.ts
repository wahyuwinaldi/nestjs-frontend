export interface ApiResponse<T = unknown> {
  success: boolean;
  error: string | null;
  data: T | null;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, error: null, data };
}

export function fail<T = null>(
  error: string,
  data: T | null = null,
): ApiResponse<T> {
  return { success: false, error, data };
}
