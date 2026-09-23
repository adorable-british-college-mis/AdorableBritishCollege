import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../common/errors.js";
import { env } from "../../config/env.js";
import { createAccessToken, createRefreshToken, hashToken } from "../../security/token.js";
import { recordAuditEvent } from "../audit/audit.service.js";

const REFRESH_COOKIE = "abc_refresh";

async function getIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE") throw new AppError(401, "ACCOUNT_UNAVAILABLE", "This account is unavailable.");

  const roles = user.roles.map((entry) => entry.role.code);
  const permissions = [...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((item) => item.permission.code)))];
  return { user, roles, permissions };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
}

export async function login(email: string, password: string, req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !valid || user.status !== "ACTIVE") {
    await recordAuditEvent({
      action: "auth.login",
      entityType: "User",
      requestId: req.requestId,
      outcome: "FAILURE",
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { email: email.toLowerCase() },
    });
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const identity = await getIdentity(user.id);
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  setRefreshCookie(res, refreshToken);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });
  return formatAuthResponse(identity);
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) throw new AppError(401, "REFRESH_REQUIRED", "A valid session is required.");

  const session = await prisma.userSession.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    clearRefreshCookie(res);
    throw new AppError(401, "INVALID_SESSION", "The session is invalid or expired.");
  }

  const identity = await getIdentity(session.userId);
  const nextToken = createRefreshToken();
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(nextToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  setRefreshCookie(res, nextToken);
  return formatAuthResponse(identity);
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    await prisma.userSession.updateMany({
      where: { refreshTokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
  if (req.auth) {
    await recordAuditEvent({
      actorUserId: req.auth.userId,
      action: "auth.logout",
      entityType: "User",
      entityId: req.auth.userId,
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });
  }
}

export async function currentUser(userId: string) {
  return formatAuthResponse(await getIdentity(userId));
}

function formatAuthResponse(identity: Awaited<ReturnType<typeof getIdentity>>) {
  const { user, roles, permissions } = identity;
  return {
    accessToken: createAccessToken({ sub: user.id, email: user.email, roles, permissions }),
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles, permissions },
  };
}
