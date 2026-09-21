import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName?: string;
  email: string;
  password_hash: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date;
  role?: string;
  status: 'active' | 'inactive' | 'suspended' | string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    role: { type: String, default: 'user' },
    status: { type: String, default: 'active' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
