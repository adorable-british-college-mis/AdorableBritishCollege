import type { AdmissionDocument, AdmissionFormData } from "../admissions/admissions-types";

export type AdmissionStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ASSESSMENT" | "INTERVIEW" | "OFFERED" | "WAITLISTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "ENROLLED";

export interface AdminAdmissionListItem {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  entryYearGroup?: string;
  entryAcademicYear: string;
  status: AdmissionStatus;
  submittedAt?: string;
  reviewedAt?: string;
  updatedAt: string;
  studentId?: string;
  parentGuardian?: string | null;
  source: string;
  documentCount: number;
}

export interface AdmissionWorkflowEvent {
  id: string;
  fromStatus?: AdmissionStatus;
  toStatus: AdmissionStatus;
  note?: string;
  metadata?: { scheduledAt?: string; score?: number };
  createdAt: string;
  actor?: { firstName: string; lastName: string };
}

export interface AdminAdmissionDetail extends AdminAdmissionListItem {
  phone?: string;
  createdAt: string;
  formData: Partial<AdmissionFormData>;
  documents: AdmissionDocument[];
  workflowEvents: AdmissionWorkflowEvent[];
  student?: { id: string; admissionNumber: string };
}

export interface AdminAdmissionsResult {
  items: AdminAdmissionListItem[];
  summary: {
    total: number; enquiries: number; submitted: number; inReview: number; interview: number; offered: number; accepted: number; waitlisted: number; enrolled: number;
    yearGroups: Array<{ name: string; count: number }>;
    sources: Array<{ name: string; count: number }>;
    trends: { enquiries: number | null; applications: number | null; offered: number | null; enrolled: number | null; waitlisted: number | null };
  };
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
