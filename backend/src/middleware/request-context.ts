import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContext: RequestHandler = (req, res, next) => {
  const suppliedId = req.header("x-request-id");
  req.requestId = suppliedId && suppliedId.length <= 128 ? suppliedId : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};
