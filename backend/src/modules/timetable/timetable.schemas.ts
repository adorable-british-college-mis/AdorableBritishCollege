import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time in HH:MM format.");

const lessonSchema = z.object({
  termId: z.uuid(),
  yearGroupId: z.uuid(),
  formGroupId: z.uuid().optional().or(z.literal("")),
  subjectId: z.uuid(),
  staffId: z.uuid().optional().or(z.literal("")),
  weekday: z.coerce.number().int().min(1).max(5),
  startsAt: time,
  endsAt: time,
  periodLabel: z.string().trim().min(2).max(40),
  room: z.string().trim().max(80).optional(),
});

export const createLessonSchema = lessonSchema.refine((value) => value.endsAt > value.startsAt, { path: ["endsAt"], message: "End time must be after start time." });
export const updateLessonSchema = createLessonSchema;

export const createCoverSchema = z.object({
  timetableSlotId: z.uuid(),
  absentStaffId: z.uuid(),
  coverStaffId: z.uuid().optional().or(z.literal("")),
  date: z.iso.date(),
  status: z.enum(["PENDING", "CONFIRMED"]).default("PENDING"),
  note: z.string().trim().max(500).optional(),
});
