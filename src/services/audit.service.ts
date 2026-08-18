import { AuditLog } from "../models/audit-log.model";

export interface RecordAuditInput {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  details?: Record<string, unknown>;
}

// Fire-and-forget: never throws and never returns a promise a caller could
// accidentally block on. A Mongo outage must never affect the primary
// (Postgres-backed) business operation — failures are logged and swallowed.
export function recordAudit(input: RecordAuditInput): void {
  AuditLog.create(input).catch((err: unknown) => {
    console.error("Failed to record audit log:", err);
  });
}
