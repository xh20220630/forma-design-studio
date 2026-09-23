export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(status, message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function errorProperty(error: unknown, key: string): unknown {
  return isRecord(error) ? error[key] : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorStatus(error: unknown): number | undefined {
  const status = errorProperty(error, 'status');
  return typeof status === 'number' ? status : undefined;
}
