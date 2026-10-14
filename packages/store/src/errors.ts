// Business errors of the store, mapped to HTTP statuses by the API and to `{code, message,
// details, hint}` tool errors by the MCP server.

export type StoreErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_DATA'
  | 'SCHEMA_VERSION'
  | 'STALE_REVISION'
  | 'LOCKED'
  | 'FORBIDDEN_PATH'
  | 'DATA_DIR_MISSING'
  | 'NOT_ARCHIVED'
  | 'IN_USE'
  | 'NOT_APPLICABLE'
  | 'ALREADY_RESOLVED'
  | 'DEPENDENCY_PENDING'
  | 'IS_DEFAULT'
  | 'ARCHIVED'
  | 'SELECTION_RULE'
  | 'GUARDRAIL_REJECTED'
  | 'SUPERSEDES_REQUIRED'
  | 'NOT_AVAILABLE'
  | 'ALREADY_EXISTS'
  | 'NO_ACTIVE_LETTER';

export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}
