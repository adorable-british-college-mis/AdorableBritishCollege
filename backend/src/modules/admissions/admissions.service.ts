import { randomBytes } from "node:crypto";
import type { AdmissionStatus, Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { hashToken } from "../../security/token.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import {
  adminApplicationListSchema,
  admissionTransitionSchema,
  enrolApplicationSchema,
  sectionKeys,
  sectionSchemas,
  type SectionKey,
} from "./admissions.schemas.js";

type AdminListInput = z.infer<typeof adminApplicationListSchema>;
type TransitionInput = z.infer<typeof admissionTransitionSchema>;
type EnrolInput = z.infer<typeof enrolApplicationSchema>;

function applicationNumber() {
  return `ABC-APP-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function publicApplication(application: Awaited<ReturnType<typeof findApplication>>) {
  return {
    id: application.id,
    applicationNumber: application.applicationNumber,
    status: application.status,
    currentStep: application.currentStep,
    email: application.email,
    firstName: application.firstName,
    lastName: application.lastName,
    entryYearGroup: application.entryYearGroup,
    entryAcademicYear: application.entryAcademicYear,
    formData: application.formData,
    submittedAt: application.submittedAt,
    updatedAt: application.updatedAt,
    documents: application.documents.map(({ id, category, originalName, mimeType, sizeBytes, uploadedAt }) => ({ id, category, originalName, mimeType, sizeBytes, uploadedAt })),
  };
}

async function findApplication(id: string) {
  const application = await prisma.admissionApplication.findUnique({ where: { id }, include: { documents: { orderBy: { uploadedAt: "desc" } } } });
  if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "The application could not be found.");
  return application;
}

export async function authorizeApplication(id: string, token: string | undefined) {
  if (!token) throw new AppError(401, "APPLICATION_TOKEN_REQUIRED", "The secure application token is required.");
  const application = await findApplication(id);
  if (hashToken(token) !== application.accessTokenHash) throw new AppError(403, "APPLICATION_ACCESS_DENIED", "The application token is invalid.");
  return application;
}

export async function startApplication(input: unknown, requestId: string) {
  const personal = sectionSchemas.personal.parse(input);
  const token = randomBytes(32).toString("base64url");
  const duplicate = await prisma.admissionApplication.findFirst({
    where: { email: personal.applicantEmail.toLowerCase(), dateOfBirth: new Date(`${personal.dateOfBirth}T00:00:00.000Z`), status: { notIn: ["REJECTED", "WITHDRAWN", "ENROLLED"] } },
    select: { id: true },
  });
  if (duplicate) throw new AppError(409, "APPLICATION_ALREADY_EXISTS", "An active application already exists for this applicant. Use Track Application to continue.");

  const application = await prisma.admissionApplication.create({
    data: {
      applicationNumber: applicationNumber(),
      accessTokenHash: hashToken(token),
      email: personal.applicantEmail.toLowerCase(),
      phone: personal.applicantPhone,
      firstName: personal.legalFirstName,
      lastName: personal.legalLastName,
      dateOfBirth: new Date(`${personal.dateOfBirth}T00:00:00.000Z`),
      currentStep: 2,
      formData: { personal },
    },
    include: { documents: true },
  });
  await recordAuditEvent({ action: "admission.application.create", entityType: "AdmissionApplication", entityId: application.id, requestId, metadata: { applicationNumber: application.applicationNumber } });
  return { application: publicApplication(application), applicationToken: token };
}

export async function getApplication(id: string, token: string | undefined) {
  return publicApplication(await authorizeApplication(id, token));
}

export async function saveSection(id: string, token: string | undefined, section: SectionKey, input: unknown, requestId: string) {
  const application = await authorizeApplication(id, token);
  if (application.status !== "DRAFT") throw new AppError(409, "APPLICATION_LOCKED", "Submitted applications can no longer be edited.");
  const sectionData = sectionSchemas[section].parse(input);
  const existing = application.formData as Record<string, Prisma.JsonValue>;
  const nextStep = Math.min(8, Math.max(application.currentStep, sectionKeys.indexOf(section) + 2));
  const updated = await prisma.admissionApplication.update({
    where: { id },
    data: {
      formData: { ...existing, [section]: sectionData } as Prisma.InputJsonValue,
      currentStep: nextStep,
      ...(section === "personal" ? {
        email: (sectionData as typeof sectionSchemas.personal._output).applicantEmail.toLowerCase(),
        phone: (sectionData as typeof sectionSchemas.personal._output).applicantPhone,
        firstName: (sectionData as typeof sectionSchemas.personal._output).legalFirstName,
        lastName: (sectionData as typeof sectionSchemas.personal._output).legalLastName,
        dateOfBirth: new Date(`${(sectionData as typeof sectionSchemas.personal._output).dateOfBirth}T00:00:00.000Z`),
      } : {}),
      ...(section === "entry" ? {
        entryYearGroup: (sectionData as typeof sectionSchemas.entry._output).yearGroup,
        entryAcademicYear: (sectionData as typeof sectionSchemas.entry._output).academicYear,
      } : {}),
    },
    include: { documents: { orderBy: { uploadedAt: "desc" } } },
  });
  await recordAuditEvent({ action: "admission.application.section.save", entityType: "AdmissionApplication", entityId: id, requestId, metadata: { section } });
  return publicApplication(updated);
}

export async function addDocument(id: string, token: string | undefined, file: Express.Multer.File, category: string, requestId: string) {
  const application = await authorizeApplication(id, token);
  if (application.status !== "DRAFT") throw new AppError(409, "APPLICATION_LOCKED", "Submitted applications can no longer be edited.");
  const document = await prisma.admissionDocument.create({
    data: { applicationId: id, category, originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, sizeBytes: file.size },
  });
  await recordAuditEvent({ action: "admission.document.upload", entityType: "AdmissionApplication", entityId: id, requestId, metadata: { category, documentId: document.id, mimeType: document.mimeType, sizeBytes: document.sizeBytes } });
  return { id: document.id, category: document.category, originalName: document.originalName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, uploadedAt: document.uploadedAt };
}

export async function submitApplication(id: string, token: string | undefined, requestId: string) {
  const application = await authorizeApplication(id, token);
  if (application.status !== "DRAFT") return publicApplication(application);
  const formData = application.formData as Record<string, unknown>;
  const missing: string[] = [];
  for (const section of sectionKeys) {
    if (!formData[section] || !sectionSchemas[section].safeParse(formData[section]).success) missing.push(section);
  }
  const documentCategories = new Set(application.documents.map((document) => document.category));
  for (const category of ["passport-photo", "identity-document", "school-report"]) {
    if (!documentCategories.has(category)) missing.push(category);
  }
  if (missing.length) throw new AppError(400, "APPLICATION_INCOMPLETE", "Complete all required sections and documents before submitting.", { missing });

  const submitted = await prisma.$transaction(async (transaction) => {
    const result = await transaction.admissionApplication.update({ where: { id }, data: { status: "SUBMITTED", currentStep: 8, submittedAt: new Date() }, include: { documents: true } });
    await transaction.admissionWorkflowEvent.create({ data: { applicationId: id, fromStatus: "DRAFT", toStatus: "SUBMITTED", note: "Application submitted by family" } });
    return result;
  });
  await recordAuditEvent({ action: "admission.application.submit", entityType: "AdmissionApplication", entityId: id, requestId, metadata: { applicationNumber: submitted.applicationNumber } });
  return publicApplication(submitted);
}

export async function trackApplication(input: { applicationNumber: string; email: string; dateOfBirth: string }) {
  const application = await prisma.admissionApplication.findFirst({
    where: { applicationNumber: input.applicationNumber.toUpperCase(), email: input.email.toLowerCase(), dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`) },
    select: { applicationNumber: true, firstName: true, lastName: true, status: true, entryYearGroup: true, entryAcademicYear: true, submittedAt: true, updatedAt: true },
  });
  if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "No matching application was found. Check the details and try again.");
  return application;
}

const adminListSelect = {
  id: true,
  applicationNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  dateOfBirth: true,
  entryYearGroup: true,
  entryAcademicYear: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  updatedAt: true,
  studentId: true,
  source: true,
  formData: true,
  documents: { select: { category: true } },
} satisfies Prisma.AdmissionApplicationSelect;

export async function listAdminApplications(input: AdminListInput) {
  const where: Prisma.AdmissionApplicationWhereInput = {
    status: input.status ?? { not: "DRAFT" },
    ...(input.yearGroup ? { entryYearGroup: input.yearGroup } : {}),
    ...(input.search ? {
      OR: [
        { applicationNumber: { contains: input.search, mode: "insensitive" } },
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
      ],
    } : {}),
  };
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, orderBy: { startsOn: "desc" } });
  const previousYear = academicYear ? await prisma.academicYear.findFirst({ where: { endsOn: { lt: academicYear.startsOn } }, orderBy: { endsOn: "desc" } }) : null;
  const yearWhere: Prisma.AdmissionApplicationWhereInput = { status: { not: "DRAFT" }, ...(academicYear ? { entryAcademicYear: academicYear.name } : {}) };
  const [items, total, statusGroups, enquiries, yearGroups, sources, previousApplications, previousEnquiries] = await Promise.all([
    prisma.admissionApplication.findMany({
      where,
      select: adminListSelect,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.admissionApplication.count({ where }),
    prisma.admissionApplication.groupBy({ where: yearWhere, by: ["status"], _count: { id: true }, orderBy: { status: "asc" } }),
    academicYear ? prisma.admissionEnquiry.count({ where: { academicYearId: academicYear.id } }) : Promise.resolve(0),
    prisma.admissionApplication.groupBy({ where: yearWhere, by: ["entryYearGroup"], _count: { id: true }, orderBy: { entryYearGroup: "asc" } }),
    prisma.admissionApplication.groupBy({ where: yearWhere, by: ["source"], _count: { id: true }, orderBy: { source: "asc" } }),
    previousYear ? prisma.admissionApplication.count({ where: { status: { not: "DRAFT" }, entryAcademicYear: previousYear.name } }) : Promise.resolve(0),
    previousYear ? prisma.admissionEnquiry.count({ where: { academicYearId: previousYear.id } }) : Promise.resolve(0),
  ] as const);
  const count = (statuses: string[]) => statusGroups.filter((group) => statuses.includes(group.status)).reduce((sum, group) => sum + group._count.id, 0);
  const change = (current: number, previous: number) => previous ? Math.round((current - previous) / previous * 1000) / 10 : null;
  const applicationTotal = statusGroups.reduce((sum, group) => sum + group._count.id, 0);
  const offered = count(["OFFERED", "ACCEPTED", "ENROLLED"]);
  return {
    items: items.map(({ formData, documents, ...item }) => {
      const guardians = (formData as { guardians?: { primaryGuardian?: { title?: string; firstName?: string; lastName?: string } } }).guardians;
      const guardian = guardians?.primaryGuardian;
      return {
        ...item,
        parentGuardian: guardian ? [guardian.title, guardian.firstName, guardian.lastName].filter(Boolean).join(" ") : null,
        source: item.source,
        documentCount: documents.length,
      };
    }),
    summary: {
      total: applicationTotal,
      enquiries,
      submitted: count(["SUBMITTED"]),
      inReview: count(["UNDER_REVIEW", "ASSESSMENT"]),
      interview: count(["INTERVIEW"]),
      offered,
      accepted: count(["ACCEPTED"]),
      waitlisted: count(["WAITLISTED"]),
      enrolled: count(["ENROLLED"]),
      yearGroups: yearGroups.map((group) => ({ name: group.entryYearGroup?.replace("YEAR_", "Year ") ?? "Other", count: group._count.id })),
      sources: sources.map((group) => ({ name: group.source, count: group._count.id })),
      trends: {
        enquiries: change(enquiries, previousEnquiries),
        applications: change(applicationTotal, previousApplications),
        offered: null,
        enrolled: null,
        waitlisted: null,
      },
    },
    pagination: { page: input.page, pageSize: input.pageSize, total, pages: Math.ceil(total / input.pageSize) },
  };
}

export async function getAdminApplication(id: string) {
  const application = await prisma.admissionApplication.findUnique({
    where: { id },
    select: {
      ...adminListSelect,
      phone: true,
      formData: true,
      createdAt: true,
      documents: { orderBy: { uploadedAt: "desc" }, select: { id: true, category: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true } },
      workflowEvents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fromStatus: true, toStatus: true, note: true, metadata: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } },
      },
      student: { select: { id: true, admissionNumber: true } },
    },
  });
  if (!application || application.status === "DRAFT") throw new AppError(404, "APPLICATION_NOT_FOUND", "The submitted application could not be found.");
  return application;
}

export async function getAdminDocument(applicationId: string, documentId: string) {
  const document = await prisma.admissionDocument.findFirst({
    where: { id: documentId, applicationId, application: { status: { not: "DRAFT" } } },
    select: { storedName: true, originalName: true, mimeType: true },
  });
  if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "The application document could not be found.");
  return document;
}

const allowedTransitions: Record<AdmissionStatus, readonly AdmissionStatus[]> = {
  DRAFT: [],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["ASSESSMENT", "INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  ASSESSMENT: ["INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["ACCEPTED", "WITHDRAWN"],
  WAITLISTED: ["OFFERED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
  ENROLLED: [],
};

export async function transitionApplication(id: string, input: TransitionInput, actorUserId: string, requestId: string) {
  const existing = await prisma.admissionApplication.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing || existing.status === "DRAFT") throw new AppError(404, "APPLICATION_NOT_FOUND", "The submitted application could not be found.");
  if (!allowedTransitions[existing.status].includes(input.targetStatus)) {
    throw new AppError(409, "INVALID_ADMISSION_TRANSITION", `An application cannot move from ${existing.status} to ${input.targetStatus}.`);
  }
  const metadata: Record<string, string | number> = {};
  if (input.scheduledAt) metadata.scheduledAt = input.scheduledAt;
  if (input.score !== undefined) metadata.score = input.score;
  await prisma.$transaction([
    prisma.admissionApplication.update({
      where: { id },
      data: { status: input.targetStatus, ...(input.targetStatus === "UNDER_REVIEW" ? { reviewedAt: new Date() } : {}) },
    }),
    prisma.admissionWorkflowEvent.create({
      data: {
        applicationId: id,
        actorUserId,
        fromStatus: existing.status,
        toStatus: input.targetStatus,
        ...(input.note ? { note: input.note } : {}),
        ...(Object.keys(metadata).length ? { metadata } : {}),
      },
    }),
  ]);
  await recordAuditEvent({ actorUserId, action: "admission.application.transition", entityType: "AdmissionApplication", entityId: id, requestId, before: { status: existing.status }, after: { status: input.targetStatus }, metadata });
  return getAdminApplication(id);
}

function generatedAdmissionNumber(applicationNumber: string) {
  return `ABC-26${applicationNumber.slice(-5).toUpperCase()}`;
}

export async function enrolAcceptedApplication(id: string, input: EnrolInput, actorUserId: string, requestId: string) {
  const application = await prisma.admissionApplication.findUnique({ where: { id }, include: { documents: true } });
  if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "The application could not be found.");
  if (application.studentId) return getAdminApplication(id);
  if (application.status !== "ACCEPTED") throw new AppError(409, "APPLICATION_NOT_ACCEPTED", "Record the family's acceptance before enrolment.");

  const formData = application.formData as Record<string, unknown>;
  const personal = sectionSchemas.personal.parse(formData.personal);
  const guardians = sectionSchemas.guardians.parse(formData.guardians);
  const entry = sectionSchemas.entry.parse(formData.entry);
  const [academicYear, yearGroup] = await Promise.all([
    prisma.academicYear.findUnique({ where: { name: entry.academicYear } }),
    prisma.yearGroup.findUnique({ where: { code: entry.yearGroup.replace("YEAR_", "Y") } }),
  ]);
  if (!academicYear || !yearGroup) throw new AppError(409, "ACADEMIC_CONFIGURATION_MISSING", "Configure the application academic year and year group before enrolment.");

  const admissionNumber = input.admissionNumber ?? generatedAdmissionNumber(application.applicationNumber);
  const guardianInputs = [guardians.primaryGuardian, ...(guardians.addSecondGuardian ? [guardians.secondGuardian] : [])];
  const student = await prisma.$transaction(async (transaction) => {
    const createdStudent = await transaction.student.create({
      data: {
        admissionNumber,
        firstName: personal.legalFirstName,
        lastName: personal.legalLastName,
        preferredName: personal.preferredName || null,
        dateOfBirth: new Date(`${personal.dateOfBirth}T00:00:00.000Z`),
        gender: personal.gender,
        nationality: personal.nationality,
        status: "ACTIVE",
        enrollments: { create: { academicYearId: academicYear.id, yearGroupId: yearGroup.id, startsOn: input.startsOn ? new Date(`${input.startsOn}T00:00:00.000Z`) : academicYear.startsOn } },
      },
    });
    for (const [index, guardianInput] of guardianInputs.entries()) {
      const existingGuardian = await transaction.parentGuardian.findFirst({
        where: { OR: [{ email: { equals: guardianInput.email.toLowerCase(), mode: "insensitive" } }, { phone: guardianInput.phone }] },
      });
      const guardian = existingGuardian ?? await transaction.parentGuardian.create({ data: { firstName: guardianInput.firstName, lastName: guardianInput.lastName, email: guardianInput.email.toLowerCase(), phone: guardianInput.phone } });
      await transaction.studentGuardian.create({
        data: {
          studentId: createdStudent.id,
          guardianId: guardian.id,
          relationship: guardianInput.relationship,
          isPrimaryContact: index === 0,
          hasParentalResponsibility: guardianInput.parentalResponsibility,
          hasPortalAccess: true,
          accessRestrictionNote: guardians.custodyOrAccessRestrictions ? guardians.restrictionDetails : null,
        },
      });
    }
    await transaction.admissionApplication.update({ where: { id }, data: { status: "ENROLLED", studentId: createdStudent.id } });
    await transaction.admissionWorkflowEvent.create({ data: { applicationId: id, actorUserId, fromStatus: "ACCEPTED", toStatus: "ENROLLED", note: `Learner record ${admissionNumber} created` } });
    return createdStudent;
  });
  await recordAuditEvent({ actorUserId, action: "admission.application.enrol", entityType: "AdmissionApplication", entityId: id, requestId, before: { status: "ACCEPTED" }, after: { status: "ENROLLED", studentId: student.id, admissionNumber } });
  return getAdminApplication(id);
}
