import mongoose, { Document, Schema } from 'mongoose';

export interface IReputationSnapshot extends Document {
  user_id?: mongoose.Types.ObjectId;
  domain_or_ip: string;
  source: string;
  reputation_band?: 'high' | 'med' | 'low' | 'bad' | string;
  blacklisted: boolean;
  checked_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const ReputationSnapshotSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    domain_or_ip: { type: String, required: true, index: true },
    source: { type: String, required: true },
    reputation_band: { type: String, default: 'high' },
    blacklisted: { type: Boolean, default: false },
    checked_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ReputationSnapshot =
  mongoose.models.ReputationSnapshot ||
  mongoose.model<IReputationSnapshot>('ReputationSnapshot', ReputationSnapshotSchema);
export default ReputationSnapshot;
