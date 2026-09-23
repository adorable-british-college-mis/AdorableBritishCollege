import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./common/errors.js";
import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { requestContext } from "./middleware/request-context.js";
import { academicsRouter } from "./modules/academics/academics.routes.js";
import { admissionsRouter } from "./modules/admissions/admissions.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { studentsRouter } from "./modules/students/students.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(requestContext);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "abc-mis-api", timestamp: new Date().toISOString() });
});
app.get("/api/v1/openapi.json", (_req, res) => res.json(openApiDocument));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/admissions", admissionsRouter);
app.use("/api/v1/students", studentsRouter);
app.use("/api/v1/academics", academicsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
