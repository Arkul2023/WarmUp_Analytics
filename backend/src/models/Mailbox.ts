import mongoose, { Document, Schema } from 'mongoose';

export interface IMailbox extends Document {
  user_id?: mongoose.Types.ObjectId;
  email: string;
  type: 'workspace' | 'smtp' | 'seed';
  domain: string;
  provider?: string;
  mailwizz_delivery_server_id?: string;
  mailwizz_customer_name?: string;
  status: 'active' | 'paused' | 'dropped';
  warmup_start_date?: Date;
  daily_cap?: number;
  policy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MailboxSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['workspace', 'smtp', 'seed'], default: 'workspace' },
    domain: { type: String },
    provider: { type: String },
    mailwizz_delivery_server_id: { type: String },
    mailwizz_customer_name: { type: String },
    status: { type: String, enum: ['active', 'paused', 'dropped'], default: 'active' },
    warmup_start_date: { type: Date, default: Date.now },
    daily_cap: { type: Number, default: 50 },
    policy: { type: String },
  },
  { timestamps: true }
);

export const Mailbox = mongoose.models.Mailbox || mongoose.model<IMailbox>('Mailbox', MailboxSchema);
export default Mailbox;
