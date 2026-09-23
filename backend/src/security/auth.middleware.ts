import type { RequestHandler } from "express";
import { AppError } from "../common/errors.js";
import { verifyAccessToken } from "./token.js";

export const requireAuthentication: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required."));
    return;
  }

  try {
    const claims = verifyAccessToken(header.slice(7));
    req.auth = {
      userId: claims.sub,
      email: claims.email,
      roles: claims.roles,
      permissions: claims.permissions,
    };
    next();
  } catch {
    next(new AppError(401, "INVALID_ACCESS_TOKEN", "The access token is invalid or expired."));
  }
};

export const requirePermission = (permission: string): RequestHandler => (req, _res, next) => {
  if (!req.auth?.permissions.includes(permission)) {
    next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    return;
  }
  next();
};
