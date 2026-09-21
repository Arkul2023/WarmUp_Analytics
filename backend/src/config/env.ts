import dotenv from "dotenv";
import path from "path";

// .env is located at the project root:
// Warmup_Analytics/.env
const envPath = path.resolve(__dirname, "../../../.env");

dotenv.config({
  path: envPath,
});

export const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/warmup_monitor";

export const MAILWIZZ_API_URL =
  process.env.MAILWIZZ_API_URL || "";

export const MAILWIZZ_API_KEY =
  process.env.MAILWIZZ_API_KEY || "";

export const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  "http://localhost:3000";

export const PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 4000;

export const SSH_ENABLED =
  process.env.SSH_ENABLED !== "false";

export const SSH_HOST =
  process.env.SSH_HOST || "15.235.163.118";

export const SSH_PORT = process.env.SSH_PORT
  ? parseInt(process.env.SSH_PORT, 10)
  : 22;

export const SSH_USER =
  process.env.SSH_USER || process.env.SSH_USERNAME || "ubuntu";

export const SSH_PASSWORD =
  process.env.SSH_PASSWORD || "Warje@130779";

export const SSH_PRIVATE_KEY =
  process.env.SSH_PRIVATE_KEY || "";

export const SSH_REMOTE_HOST =
  process.env.SSH_REMOTE_HOST || "127.0.0.1";

export const SSH_REMOTE_PORT = process.env.SSH_REMOTE_PORT
  ? parseInt(process.env.SSH_REMOTE_PORT, 10)
  : 3306;

export const SSH_LOCAL_PORT = process.env.SSH_LOCAL_PORT
  ? parseInt(process.env.SSH_LOCAL_PORT, 10)
  : 3307;