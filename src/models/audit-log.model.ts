import { Schema, model, Document } from "mongoose";

export interface AuditLogDocument extends Document {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>({
  userId: { type: Number, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: Number, required: true },
  details: { type: Schema.Types.Mixed, required: false },
  createdAt: { type: Date, default: Date.now },
});

export const AuditLog = model<AuditLogDocument>("AuditLog", auditLogSchema);
