import mongoose, { Document, Schema } from 'mongoose';

export type SecurityEventType =
  | 'SIGNUP'
  | 'EMAIL_VERIFICATION_REQUESTED'
  | 'EMAIL_VERIFIED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED';

export interface ISecurityEvent extends Document {
  userId?: mongoose.Types.ObjectId;
  eventType: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt?: Date;
}

const SecurityEventSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    eventType: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SecurityEventSchema.index({ userId: 1, eventType: 1, createdAt: 1 });

export const SecurityEvent =
  mongoose.models.SecurityEvent || mongoose.model<ISecurityEvent>('SecurityEvent', SecurityEventSchema);
