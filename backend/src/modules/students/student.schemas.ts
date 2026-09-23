import { z } from "zod";

export const studentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["APPLICANT", "ACTIVE", "WITHDRAWN", "GRADUATED", "ARCHIVED"]).optional(),
  yearGroupId: z.uuid().optional(),
  formGroupId: z.uuid().optional(),
  houseId: z.uuid().optional(),
});

export const createStudentSchema = z.object({
  admissionNumber: z.string().trim().max(32).optional().or(z.literal("")),
  title: z.string().trim().max(20).optional(),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional(),
  dateOfBirth: z.iso.date(),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "NOT_STATED"]).default("NOT_STATED"),
  nationality: z.string().trim().max(80).optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  townCity: z.string().trim().max(100).optional(),
  postcode: z.string().trim().max(20).optional(),
  yearGroupId: z.uuid(),
  academicYearId: z.uuid(),
  formGroupId: z.uuid().optional().or(z.literal("")),
  houseId: z.uuid().optional().or(z.literal("")),
  enrolmentDate: z.iso.date(),
  status: z.enum(["APPLICANT", "ACTIVE"]).default("ACTIVE"),
  guardian: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    relationship: z.string().trim().min(1).max(40),
    email: z.email().optional().or(z.literal("")),
    phone: z.string().trim().max(32).optional(),
  }),
});
