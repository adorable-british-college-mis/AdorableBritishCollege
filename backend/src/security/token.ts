import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export function createAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<jwt.SignOptions["expiresIn"]>,
    issuer: "abc-mis",
    audience: "abc-mis-web",
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: "abc-mis",
    audience: "abc-mis-web",
  });

  if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid access token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    roles: Array.isArray(payload.roles) ? payload.roles.filter((v): v is string => typeof v === "string") : [],
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.filter((v): v is string => typeof v === "string")
      : [],
  };
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
