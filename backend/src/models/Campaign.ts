import mongoose, { Document, Schema } from 'mongoose';

export interface ICampaign extends Document {
  user_id?: mongoose.Types.ObjectId;
  mailwizz_campaign_id?: string;
  campaign_name: string;
  case_number?: number;
  from_group?: string;
  to_group?: string;
  list_id?: string;
  list_name?: string;
  mailwizz_customer_name?: string;
  status: string;
  send_date?: string;
  send_time?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CampaignSchema: Schema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    mailwizz_campaign_id: { type: String, index: true },
    campaign_name: { type: String, required: true },
    case_number: { type: Number },
    from_group: { type: String },
    to_group: { type: String },
    list_id: { type: String },
    list_name: { type: String },
    mailwizz_customer_name: { type: String },
    status: { type: String, default: 'active' },
    send_date: { type: String },
    send_time: { type: String },
  },
  { timestamps: true }
);

export const Campaign = mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);
export default Campaign;
