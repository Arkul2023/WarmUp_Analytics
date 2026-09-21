import mongoose, { Document, Schema } from 'mongoose';

export interface ISendEvent extends Document {
  user_id?: mongoose.Types.ObjectId;
  campaign_id?: mongoose.Types.ObjectId;
  mailbox_id?: mongoose.Types.ObjectId;
  recipient_id?: mongoose.Types.ObjectId;
  recipient_email: string;
  mailwizz_status: string;
  bounce_reason?: string;
  error_code?: string;
  smtp_response?: string;
  sent_at?: Date;
  last_synced_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const SendEventSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    mailbox_id: { type: Schema.Types.ObjectId, ref: 'Mailbox', index: true },
    recipient_id: { type: Schema.Types.ObjectId, ref: 'Recipient' },
    recipient_email: { type: String, required: true },
    mailwizz_status: { type: String, default: 'sent' },
    bounce_reason: { type: String },
    error_code: { type: String },
    smtp_response: { type: String },
    sent_at: { type: Date, default: Date.now },
    last_synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const SendEvent = mongoose.models.SendEvent || mongoose.model<ISendEvent>('SendEvent', SendEventSchema);
export default SendEvent;
