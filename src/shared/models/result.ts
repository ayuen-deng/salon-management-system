export type Result<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NEEDS_APPROVAL'
  | 'INTERNAL_ERROR';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function fail<E = DomainError>(error: E): Result<never, E> {
  return { success: false, error };
}
