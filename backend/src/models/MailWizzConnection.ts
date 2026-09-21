import mongoose, { Document, Schema } from 'mongoose';

export type MailWizzConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'error';

export interface IMailWizzConnection extends Document {
  user_id?: mongoose.Types.ObjectId;
  name: string;

  // Server (SSH) Credentials
  ssh_host: string;
  ssh_port: number;
  ssh_user: string;
  ssh_password?: string;

  // Database Credentials
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;

  // Optional API details
  base_url?: string;
  api_key?: string;

  status: MailWizzConnectionStatus;
  last_sync_at?: Date;
  last_error?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const MailWizzConnectionSchema = new Schema<IMailWizzConnection>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Server SSH details
    ssh_host: {
      type: String,
      default: '15.235.163.118',
      trim: true,
    },
    ssh_port: {
      type: Number,
      default: 22,
    },
    ssh_user: {
      type: String,
      default: 'ubuntu',
      trim: true,
    },
    ssh_password: {
      type: String,
      default: '',
    },

    // Database details
    host: {
      type: String,
      default: '127.0.0.1',
      trim: true,
    },
    port: {
      type: Number,
      default: 3307,
    },
    database: {
      type: String,
      default: 'mailwizz',
      trim: true,
    },
    user: {
      type: String,
      default: 'mailwizzadmin',
      trim: true,
    },
    password: {
      type: String,
      default: '',
    },

    base_url: {
      type: String,
      default: '',
      trim: true,
    },
    api_key: {
      type: String,
      default: '',
      trim: true,
    },

    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error'],
      default: 'disconnected',
    },

    last_sync_at: {
      type: Date,
    },

    last_error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const MailWizzConnection =
  mongoose.models.MailWizzConnection ||
  mongoose.model<IMailWizzConnection>(
    'MailWizzConnection',
    MailWizzConnectionSchema
  );

export default MailWizzConnection;