import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { behaviourCategorySchema, behaviourEventSchema, behaviourRewardSchema, behaviourSanctionSchema, updateBehaviourCategorySchema, updateBehaviourEventSchema, updateBehaviourRewardSchema, updateBehaviourSanctionSchema } from "./behaviour.schemas.js";
import * as behaviour from "./behaviour.service.js";

export const behaviourRouter = Router();
behaviourRouter.use(requireAuthentication);
const actor = (req: Express.Request) => ({ userId: req.auth!.userId });
const id = (req: { params: Record<string, string | string[]> }) => z.uuid().parse(req.params.id);

behaviourRouter.get("/overview", requirePermission("behaviour.read"), asyncHandler(async (_req, res) => res.json({ data: await behaviour.getOverview() })));
behaviourRouter.get("/reference", requirePermission("behaviour.read"), asyncHandler(async (_req, res) => res.json({ data: await behaviour.getReference() })));

behaviourRouter.post("/categories", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await behaviour.createCategory(behaviourCategorySchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.patch("/categories/:id", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.updateCategory(id(req), updateBehaviourCategorySchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.post("/categories/:id/archive", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.archiveCategory(id(req), actor(req), req.requestId) })));

behaviourRouter.post("/events", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await behaviour.createEvent(behaviourEventSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.patch("/events/:id", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.updateEvent(id(req), updateBehaviourEventSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.post("/events/:id/archive", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.archiveEvent(id(req), actor(req), req.requestId) })));

behaviourRouter.post("/rewards", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await behaviour.createReward(behaviourRewardSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.patch("/rewards/:id", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.updateReward(id(req), updateBehaviourRewardSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.post("/rewards/:id/archive", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.archiveReward(id(req), actor(req), req.requestId) })));

behaviourRouter.post("/sanctions", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await behaviour.createSanction(behaviourSanctionSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.patch("/sanctions/:id", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.updateSanction(id(req), updateBehaviourSanctionSchema.parse(req.body), actor(req), req.requestId) })));
behaviourRouter.post("/sanctions/:id/archive", requirePermission("behaviour.manage"), asyncHandler(async (req, res) => res.json({ data: await behaviour.archiveSanction(id(req), actor(req), req.requestId) })));
