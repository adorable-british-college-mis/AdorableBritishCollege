import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication } from "../../security/auth.middleware.js";
import * as authService from "./auth.service.js";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(128) });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: "draft-8", legacyHeaders: false });

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
