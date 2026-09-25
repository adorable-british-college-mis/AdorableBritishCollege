import { z } from "zod";

const optionalText = (max = 500) => z.string().trim().max(max).optional().default("");
const requiredText = (label: string, max = 160) => z.string().trim().min(1, `${label} is required`).max(max);

export const personalDetailsSchema = z.object({
  legalFirstName: requiredText("Legal first name", 80),
  legalLastName: requiredText("Legal last name", 80),
  preferredName: optionalText(80),
  dateOfBirth: z.iso.date(),
  gender: z.enum(["MALE", "FEMALE"]),
  nationality: requiredText("Nationality", 80),
  countryOfBirth: requiredText("Country of birth", 80),
  religion: optionalText(80),
  firstLanguage: requiredText("First language", 80),
  additionalLanguages: optionalText(200),
  applicantEmail: z.email(),
  applicantPhone: z.string().trim().min(7).max(30),
});

export const yearGroupEntrySchema = z.object({
  academicYear: z.literal("2026/2027"),
  yearGroup: z.enum(["YEAR_7", "YEAR_9", "YEAR_12"]),
  entryTerm: z.enum(["AUTUMN", "SPRING", "SUMMER"]),
  pupilType: z.enum(["DAY", "BOARDING", "FLEXI_BOARDING"]),
  currentSchoolYear: requiredText("Current school year", 40),
  proposedStartDate: z.iso.date(),
});

const addressSchema = z.object({
  line1: requiredText("Address line 1", 120),
  line2: optionalText(120),
  city: requiredText("Town or city", 80),
  countyState: optionalText(80),
  postcode: optionalText(20),
  country: requiredText("Country", 80),
});

const guardianSchema = z.object({
  title: z.enum(["MR", "MRS", "MS", "DR", "PROF", "OTHER"]),
  firstName: requiredText("Guardian first name", 80),
  lastName: requiredText("Guardian last name", 80),
  relationship: z.enum(["MOTHER", "FATHER", "STEP_PARENT", "LEGAL_GUARDIAN", "OTHER"]),
  parentalResponsibility: z.boolean(),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  alternatePhone: optionalText(30),
  occupation: optionalText(100),
  address: addressSchema,
  livesWithApplicant: z.boolean(),
  preferredContactMethod: z.enum(["EMAIL", "SMS", "PHONE"]),
});

const parentGuardianFields = {
  primaryGuardian: guardianSchema,
  custodyOrAccessRestrictions: z.boolean(),
  restrictionDetails: optionalText(1000),
};

export const parentGuardianSchema = z.discriminatedUnion("addSecondGuardian", [
  z.object({ ...parentGuardianFields, addSecondGuardian: z.literal(false), secondGuardian: z.unknown().optional() }),
  z.object({ ...parentGuardianFields, addSecondGuardian: z.literal(true), secondGuardian: guardianSchema }),
]).superRefine((value, context) => {
  if (value.custodyOrAccessRestrictions && !value.restrictionDetails) {
    context.addIssue({ code: "custom", path: ["restrictionDetails"], message: "Provide the relevant access or custody details" });
  }
}).transform((value) => {
  if (value.addSecondGuardian) return value;
  return {
    primaryGuardian: value.primaryGuardian,
    addSecondGuardian: value.addSecondGuardian,
    custodyOrAccessRestrictions: value.custodyOrAccessRestrictions,
    restrictionDetails: value.restrictionDetails,
  };
});

export const academicBackgroundSchema = z.object({
  previousSchoolName: requiredText("Current or previous school", 160),
  previousSchoolAddress: optionalText(300),
  previousSchoolCountry: requiredText("School country", 80),
  attendanceFrom: z.iso.date(),
  attendanceTo: z.iso.date().optional().or(z.literal("")),
  curriculum: z.literal("NIGERIAN_BRITISH_BLEND"),
  currentYearGroup: requiredText("Current year group", 40),
  reasonForLeaving: z.enum(["ACADEMIC_PROGRESSION", "RELOCATION", "CHANGE_OF_CURRICULUM", "BOARDING_REQUIREMENT", "FAMILY_CIRCUMSTANCES", "CURRENT_SCHOOL_CLOSURE", "OTHER"]),
  headteacherName: optionalText(120),
  schoolEmail: z.union([z.email(), z.literal("")]),
  schoolPhone: optionalText(30),
  englishProficiency: z.enum(["NATIVE", "FLUENT", "INTERMEDIATE", "BEGINNER"]),
  learningStrengths: optionalText(800),
  supportHistory: optionalText(800),
  permissionToContactSchool: z.boolean(),
});

export const medicalWelfareSchema = z.object({
  doctorName: optionalText(120),
  doctorPhone: optionalText(30),
  bloodGroup: optionalText(10),
  medicalConditions: optionalText(1000),
  allergies: optionalText(1000),
  regularMedication: optionalText(1000),
  dietaryRequirements: optionalText(600),
  disabilitiesOrSend: z.boolean(),
  sendDetails: optionalText(1200),
  immunisationsUpToDate: z.enum(["YES", "NO", "UNKNOWN"]),
  mentalHealthOrWelfareNeeds: optionalText(1000),
  emergencyTreatmentConsent: z.literal(true),
}).superRefine((value, context) => {
  if (value.disabilitiesOrSend && !value.sendDetails) context.addIssue({ code: "custom", path: ["sendDetails"], message: "Describe the support currently required" });
});

const emergencyContactSchema = z.object({
  fullName: requiredText("Emergency contact name", 120),
  relationship: requiredText("Relationship", 80),
  primaryPhone: z.string().trim().min(7).max(30),
  alternatePhone: optionalText(30),
  email: z.union([z.email(), z.literal("")]),
  authorisedToCollect: z.boolean(),
});

export const emergencyContactsSchema = z.object({
  contacts: z.array(emergencyContactSchema).min(1).max(2),
  collectionNotes: optionalText(600),
});

export const supportingDocumentsSchema = z.object({
  additionalInformation: optionalText(1000),
});

export const declarationSchema = z.object({
  informationAccurate: z.literal(true),
  parentalResponsibilityConfirmed: z.literal(true),
  privacyNoticeAccepted: z.literal(true),
  admissionsTermsAccepted: z.literal(true),
  marketingConsent: z.boolean(),
  signatoryName: requiredText("Signatory name", 120),
  signatoryRelationship: requiredText("Relationship to applicant", 80),
  signedOn: z.iso.date(),
});

export const sectionSchemas = {
  personal: personalDetailsSchema,
  entry: yearGroupEntrySchema,
  guardians: parentGuardianSchema,
  academic: academicBackgroundSchema,
  medical: medicalWelfareSchema,
  emergency: emergencyContactsSchema,
  documents: supportingDocumentsSchema,
  declaration: declarationSchema,
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export const sectionKeys = Object.keys(sectionSchemas) as SectionKey[];

export const trackApplicationSchema = z.object({
  applicationNumber: z.string().trim().min(8).max(32),
});

export const adminApplicationListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "ASSESSMENT", "INTERVIEW", "OFFERED", "WAITLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "ENROLLED"]).optional(),
  yearGroup: z.enum(["YEAR_7", "YEAR_9", "YEAR_12"]).optional(),
});

export const adminApplicationUpdateSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  dateOfBirth: z.iso.date(),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  entryYearGroup: z.enum(["YEAR_7", "YEAR_9", "YEAR_12"]),
});

export const admissionTransitionSchema = z.object({
  targetStatus: z.enum(["UNDER_REVIEW", "ASSESSMENT", "INTERVIEW", "OFFERED", "WAITLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"]),
  note: z.string().trim().max(2000).optional().default(""),
  scheduledAt: z.iso.datetime().optional(),
  score: z.number().min(0).max(100).optional(),
}).superRefine((value, context) => {
  if (["WAITLISTED", "REJECTED", "WITHDRAWN"].includes(value.targetStatus) && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "A decision note is required for this outcome" });
  }
});

export const enrolApplicationSchema = z.object({
  admissionNumber: z.string().trim().min(4).max(40).optional(),
  startsOn: z.iso.date().optional(),
});

export const documentCategorySchema = z.enum([
  "passport-photo",
  "identity-document",
  "school-report",
  "immunisation-record",
  "transfer-letter",
  "medical-evidence",
  "send-evidence",
  "other",
]);
