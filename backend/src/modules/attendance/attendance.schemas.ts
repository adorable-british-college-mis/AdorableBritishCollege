import { z } from "zod";

export const attendanceCodeSchema = z.enum([
  "PRESENT",
  "LATE",
  "ABSENT",
  "AUTHORISED_ABSENCE",
  "UNAUTHORISED_ABSENCE",
  "MEDICAL",
  "OTHER",
]);

export const openRegisterSchema = z.object({
  timetableSlotId: z.uuid(),
  date: z.iso.date(),
});

export const saveRegisterSchema = z.object({
  records: z.array(z.object({
    studentId: z.uuid(),
    status: attendanceCodeSchema,
    note: z.string().trim().max(500).optional().default(""),
  })).max(500),
});
