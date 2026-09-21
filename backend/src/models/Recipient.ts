import mongoose, { Document, Schema } from 'mongoose';

export interface IRecipient extends Document {
  user_id: mongoose.Types.ObjectId;
  email_address: string;
  type: 'seed_gmail' | 'employee_test' | string;
  provider?: string;
  outlook_profile?: string;
  move_to_inbox_policy?: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const RecipientSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email_address: { type: String, required: true, index: true },
    type: { type: String, required: true },
    provider: { type: String },
    outlook_profile: { type: String },
    move_to_inbox_policy: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RecipientSchema.index({ user_id: 1, email_address: 1 }, { unique: false });

export const Recipient = mongoose.models.Recipient || mongoose.model<IRecipient>('Recipient', RecipientSchema);
