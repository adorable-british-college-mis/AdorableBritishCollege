import { z } from "zod";

export const reportTypeSchema = z.enum(["ACADEMIC", "ATTENDANCE", "BEHAVIOUR", "STUDENT", "EXAM", "OTHER"]);

export const reportFiltersSchema = z.object({
  academicYearId: z.uuid().optional(),
  termId: z.uuid().optional(),
  yearGroupId: z.uuid().optional(),
  studentId: z.uuid().optional(),
  type: reportTypeSchema.optional(),
});

export const generateReportSchema = reportFiltersSchema.omit({ type: true }).extend({
  type: reportTypeSchema,
  name: z.string().trim().min(3).max(160).optional(),
});
