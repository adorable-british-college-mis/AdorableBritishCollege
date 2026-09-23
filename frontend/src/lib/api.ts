import type { AcademicReference, AuthUser, CreateStudentInput, DashboardSummary, Student, StudentStats } from "../types";
import type { AdmissionApplication, AdmissionDocument, AdmissionFormData, AdmissionSection } from "../features/admissions/admissions-types";
import type { AdminAdmissionDetail, AdminAdmissionsResult, AdmissionStatus } from "../features/admissions-admin/admissions-admin-types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
let accessToken: string | null = null;

interface ApiEnvelope<T> { data: T }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

function apiErrorMessage(error: { code?: string; message?: string; details?: unknown }) {
  const fallback = error.message ?? "The request failed.";
  if (error.code !== "VALIDATION_ERROR" || !Array.isArray(error.details)) return fallback;
  const issue = error.details.find((detail): detail is { path?: unknown[]; message: string } =>
    typeof detail === "object" && detail !== null && typeof (detail as { message?: unknown }).message === "string");
  if (!issue) return fallback;
  const field = issue.path?.filter((part) => typeof part === "string" || typeof part === "number").join(" ");
  return field ? `${issue.message} (${field})` : issue.message;
}

export function setAccessToken(token: string | null) { accessToken = token; }

async function request<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && allowRefresh && path !== "/auth/refresh") {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { code: "REQUEST_FAILED", message: "The request failed." } }));
    const error = body.error ?? { code: "REQUEST_FAILED", message: "The request failed." };
    throw new ApiError(response.status, error.code ?? "REQUEST_FAILED", apiErrorMessage(error), error.details);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json() as ApiEnvelope<T>).data;
}

export interface AuthResponse { accessToken: string; user: AuthUser }

export async function login(email: string, password: string) {
  const auth = await request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
  setAccessToken(auth.accessToken);
  return auth;
}

export async function refreshSession() {
  const auth = await request<AuthResponse>("/auth/refresh", { method: "POST" }, false);
  setAccessToken(auth.accessToken);
  return auth;
}

export async function logout() {
  await request<void>("/auth/logout", { method: "POST" }, false).catch(() => undefined);
  setAccessToken(null);
}

export function getStudentStats() { return request<StudentStats>("/students/stats"); }
export function getDashboardSummary() { return request<DashboardSummary>("/dashboard/summary"); }
export function getStudents(search = "", page = 1, pageSize = 20, filters: { yearGroupId?: string; formGroupId?: string; houseId?: string; status?: string } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  return request<{ items: Student[]; pagination: { page: number; pageSize: number; total: number; pages: number } }>(`/students?${query}`);
}
export function createStudent(input: CreateStudentInput) {
  return request<Student>("/students", { method: "POST", body: JSON.stringify(input) });
}
export function archiveStudent(studentId: string) {
  return request<Student>(`/students/${studentId}/archive`, { method: "POST" });
}
export function getAcademicReference() {
  return request<AcademicReference>("/academics/reference");
}

export function startAdmissionApplication(personal: AdmissionFormData["personal"]) {
  return request<{ application: AdmissionApplication; applicationToken: string }>("/admissions/applications", { method: "POST", body: JSON.stringify(personal) }, false);
}

export function getAdmissionApplication(id: string, token: string) {
  return request<AdmissionApplication>(`/admissions/applications/${id}`, { headers: { "x-application-token": token } }, false);
}

export function saveAdmissionSection<K extends AdmissionSection>(id: string, token: string, section: K, data: AdmissionFormData[K]) {
  return request<AdmissionApplication>(`/admissions/applications/${id}/sections/${section}`, { method: "PATCH", headers: { "x-application-token": token }, body: JSON.stringify(data) }, false);
}

export function uploadAdmissionDocument(id: string, token: string, category: string, file: File) {
  const body = new FormData();
  body.append("category", category);
  body.append("file", file);
  return request<AdmissionApplication["documents"][number]>(`/admissions/applications/${id}/documents`, { method: "POST", headers: { "x-application-token": token }, body }, false);
}

export function submitAdmissionApplication(id: string, token: string) {
  return request<AdmissionApplication>(`/admissions/applications/${id}/submit`, { method: "POST", headers: { "x-application-token": token } }, false);
}

export function trackAdmissionApplication(input: { applicationNumber: string; email: string; dateOfBirth: string }) {
  return request<{ applicationNumber: string; firstName: string; lastName: string; status: string; entryYearGroup?: string; entryAcademicYear: string; submittedAt?: string; updatedAt: string }>("/admissions/track", { method: "POST", body: JSON.stringify(input) }, false);
}

export function getAdminAdmissions(filters: { search?: string; status?: string; yearGroup?: string; page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 50) });
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.yearGroup) query.set("yearGroup", filters.yearGroup);
  return request<AdminAdmissionsResult>(`/admissions/admin/applications?${query}`);
}

export function getAdminAdmission(id: string) {
  return request<AdminAdmissionDetail>(`/admissions/admin/applications/${id}`);
}

export function transitionAdmission(id: string, input: { targetStatus: AdmissionStatus; note?: string; scheduledAt?: string; score?: number }) {
  return request<AdminAdmissionDetail>(`/admissions/admin/applications/${id}/transition`, { method: "POST", body: JSON.stringify(input) });
}

export function enrolAdmission(id: string, input: { admissionNumber?: string; startsOn?: string } = {}) {
  return request<AdminAdmissionDetail>(`/admissions/admin/applications/${id}/enrol`, { method: "POST", body: JSON.stringify(input) });
}

export async function downloadAdminAdmissionDocument(applicationId: string, document: AdmissionDocument) {
  const headers = new Headers();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}/admissions/admin/applications/${applicationId}/documents/${document.id}`, { headers, credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, "DOWNLOAD_FAILED", "The document could not be downloaded.");
  const url = URL.createObjectURL(await response.blob());
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.originalName;
  link.click();
  URL.revokeObjectURL(url);
}
