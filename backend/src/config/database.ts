import mongoose from "mongoose";

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in .env");
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });

    console.log("MongoDB connected successfully");
  } catch (error: any) {
    console.warn("MongoDB not running (operating in standalone mode):", error?.message || error);
  }
};