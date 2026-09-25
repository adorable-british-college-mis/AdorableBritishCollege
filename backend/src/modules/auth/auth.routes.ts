import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { env } from "../../config/env.js";
import { requireAuthentication } from "../../security/auth.middleware.js";
import * as authService from "./auth.service.js";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(128) });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 10 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many sign-in attempts. Please wait a few minutes and try again.",
        requestId: req.requestId,
      },
    });
  },
});

export const authRouter = Router();

authRouter.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  res.json({ data: await authService.login(body.email, body.password, req, res) });
}));

authRouter.post("/refresh", authLimiter, asyncHandler(async (req, res) => {
  res.json({ data: await authService.refresh(req, res) });
}));

authRouter.post("/logout", requireAuthentication, asyncHandler(async (req, res) => {
  await authService.logout(req, res);
  res.status(204).send();
}));

authRouter.get("/me", requireAuthentication, asyncHandler(async (req, res) => {
  res.json({ data: await authService.currentUser(req.auth!.userId) });
}));
