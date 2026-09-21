import mongoose, { Document, Schema } from 'mongoose';

export interface IPlacementEvent extends Document {
  user_id: mongoose.Types.ObjectId;
  send_event_id?: mongoose.Types.ObjectId;
  recipient_id?: mongoose.Types.ObjectId;
  provider?: string;
  folder?: 'inbox' | 'spam' | 'promotions' | 'not_found' | string;
  checked_at?: Date;
  moved_to_inbox?: boolean;
  replied?: boolean;
  reply_at?: Date;
  message_id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PlacementEventSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    send_event_id: { type: Schema.Types.ObjectId, ref: 'SendEvent', required: true, index: true },
    recipient_id: { type: Schema.Types.ObjectId, ref: 'Recipient' },
    provider: { type: String },
    folder: { type: String, enum: ['inbox', 'spam', 'promotions', 'not_found'], required: true },
    checked_at: { type: Date },
    moved_to_inbox: { type: Boolean },
    replied: { type: Boolean },
    reply_at: { type: Date },
    message_id: { type: String },
  },
  { timestamps: true }
);

PlacementEventSchema.index({ user_id: 1, send_event_id: 1 });

export const PlacementEvent =
  mongoose.models.PlacementEvent || mongoose.model<IPlacementEvent>('PlacementEvent', PlacementEventSchema);
