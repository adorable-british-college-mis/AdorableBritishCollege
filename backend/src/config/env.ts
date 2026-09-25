import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  RESEND_API_KEY: z.string().trim().optional().default(""),
  RESEND_FROM_EMAIL: z.string().trim().optional().default(""),
  RESEND_WEBHOOK_SECRET: z.string().trim().optional().default(""),
  TWILIO_ACCOUNT_SID: z.string().trim().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().trim().optional().default(""),
  TWILIO_WHATSAPP_FROM: z.string().trim().optional().default(""),
  COMMUNICATION_PUBLIC_URL: z.union([z.url(), z.literal("")]).optional().default(""),
  DEFAULT_COUNTRY_CALLING_CODE: z.string().trim().regex(/^\+[1-9]\d{0,3}$/).default("+234"),
});

export const env = envSchema.parse(process.env);
