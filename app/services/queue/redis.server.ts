import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root as well as cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const redisConnection = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      }
    })
  : new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      }
    });

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("Connected to Redis successfully");
});
