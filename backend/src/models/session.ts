import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionTokenHash: string;
  expiresAt: Date;
  createdAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

const SessionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionTokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
