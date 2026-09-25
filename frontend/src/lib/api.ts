import type {
  AcademicOverview,
  AcademicReference,
  AuthUser,
  CreateStudentInput,
  DashboardSummary,
  Student,
  StudentStats,
  TimetableOverview,
  AttendanceOverview,
  AttendanceRegisterDetail,
  AttendanceCode,
  BehaviourOverview,
  BehaviourReference,
  GeneratedReport,
  ReportsOverview,
  ReportType,
  CommunicationOverview,
  CommunicationThread,
  CommunicationMessage,
  Announcement,
  CommunicationRecipientType,
} from "../types";
import type {
  AdmissionApplication,
  AdmissionDocument,
  AdmissionFormData,
  AdmissionSection,
} from "../features/admissions/admissions-types";
import type {
  AdminAdmissionDetail,
  AdminAdmissionsResult,
  AdmissionStatus,
} from "../features/admissions-admin/admissions-admin-types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
let accessToken: string | null = null;

interface ApiEnvelope<T> {
  data: T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function apiErrorMessage(error: {
  code?: string;
  message?: string;
  details?: unknown;
}) {
  const fallback = error.message ?? "The request failed.";
  if (error.code !== "VALIDATION_ERROR" || !Array.isArray(error.details))
    return fallback;
  const issue = error.details.find(
    (detail): detail is { path?: unknown[]; message: string } =>
      typeof detail === "object" &&
      detail !== null &&
      typeof (detail as { message?: unknown }).message === "string",
  );
  if (!issue) return fallback;
  const field = issue.path
    ?.filter((part) => typeof part === "string" || typeof part === "number")
    .join(" ");
  return field ? `${issue.message} (${field})` : issue.message;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && allowRefresh && path !== "/auth/refresh") {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const rawBody = await response.text();
    let body: { error?: { code?: string; message?: string; details?: unknown } };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      body = {
        error: {
          code: response.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED",
          message: rawBody.trim() || (response.status === 429
            ? "Too many requests. Please wait a few minutes and try again."
            : "The request failed."),
        },
      };
    }
    const error = body.error ?? {
      code: "REQUEST_FAILED",
      message: "The request failed.",
    };
    throw new ApiError(
      response.status,
      error.code ?? "REQUEST_FAILED",
      apiErrorMessage(error),
      error.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as ApiEnvelope<T>).data;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(email: string, password: string) {
  const auth = await request<AuthResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  setAccessToken(auth.accessToken);
  return auth;
}

export async function refreshSession() {
  const auth = await request<AuthResponse>(
    "/auth/refresh",
    { method: "POST" },
    false,
  );
  setAccessToken(auth.accessToken);
  return auth;
}

export async function logout() {
  await request<void>("/auth/logout", { method: "POST" }, false).catch(
    () => undefined,
  );
  setAccessToken(null);
}

export function getStudentStats() {
  return request<StudentStats>("/students/stats");
}
export function getDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}
export function getStudents(
  search = "",
  page = 1,
  pageSize = 20,
  filters: {
    yearGroupId?: string;
    formGroupId?: string;
    houseId?: string;
    status?: string;
  } = {},
) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) query.set("search", search);
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<{
    items: Student[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pages: number;
    };
  }>(`/students?${query}`);
}
export function createStudent(input: CreateStudentInput) {
  return request<Student>("/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function getStudent(studentId: string) {
  return request<Student>(`/students/${studentId}`);
}
export function updateStudent(studentId: string, input: CreateStudentInput) {
  return request<Student>(`/students/${studentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
export function archiveStudent(studentId: string) {
  return request<Student>(`/students/${studentId}/archive`, { method: "POST" });
}
export function getAcademicReference() {
  return request<AcademicReference>("/academics/reference");
}
export function getAcademicOverview() {
  return request<AcademicOverview>("/academics/overview");
}
export function createAcademicSubject(input: {
  code: string;
  name: string;
  departmentId?: string;
}) {
  return request("/academics/subjects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateAcademicSubject(id: string, input: { code?: string; name?: string; departmentId?: string }) { return request(`/academics/subjects/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAcademicSubject(id: string) { return request(`/academics/subjects/${id}/archive`, { method: "POST" }); }
export function createAcademicDepartment(input: { code: string; name: string; description?: string }) { return request("/academics/departments", { method: "POST", body: JSON.stringify(input) }); }
export function updateAcademicDepartment(id: string, input: { code?: string; name?: string; description?: string }) { return request(`/academics/departments/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAcademicDepartment(id: string) { return request(`/academics/departments/${id}/archive`, { method: "POST" }); }
export function createAcademicCurriculum(input: { code: string; name: string; description?: string; academicYearId: string; yearGroupId?: string; subjectIds: string[] }) { return request("/academics/curricula", { method: "POST", body: JSON.stringify(input) }); }
export function updateAcademicCurriculum(id: string, input: { code?: string; name?: string; description?: string; academicYearId?: string; yearGroupId?: string; subjectIds?: string[] }) { return request(`/academics/curricula/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAcademicCurriculum(id: string) { return request(`/academics/curricula/${id}/archive`, { method: "POST" }); }
export function createAcademicClass(input: {
  code: string;
  name: string;
  yearGroupId: string;
  tutorStaffId?: string;
  curriculumId?: string;
  departmentId?: string;
}) {
  return request("/academics/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateAcademicClass(id: string, input: { code?: string; name?: string; yearGroupId?: string; tutorStaffId?: string; curriculumId?: string; departmentId?: string }) { return request(`/academics/classes/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAcademicClass(id: string) { return request(`/academics/classes/${id}/archive`, { method: "POST" }); }
export function createAcademicTeacher(input: {
  staffNumber: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  jobTitle: string;
}) {
  return request("/academics/teachers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateAcademicTeacher(id: string, input: { staffNumber?: string; firstName?: string; lastName?: string; departmentId?: string; jobTitle?: string }) { return request(`/academics/teachers/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAcademicTeacher(id: string) { return request(`/academics/teachers/${id}/archive`, { method: "POST" }); }
export function createTeachingAssignment(input: { academicYearId: string; formGroupId: string; subjectId: string; staffId: string; departmentId?: string }) { return request("/academics/teaching-assignments", { method: "POST", body: JSON.stringify(input) }); }
export function updateTeachingAssignment(id: string, input: { academicYearId?: string; formGroupId?: string; subjectId?: string; staffId?: string; departmentId?: string }) { return request(`/academics/teaching-assignments/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveTeachingAssignment(id: string) { return request(`/academics/teaching-assignments/${id}/archive`, { method: "POST" }); }
export function createAssessmentPlan(input: {
  title: string;
  termId: string;
  yearGroupId: string;
  subjectId?: string;
  dueAt: string;
}) {
  return request("/academics/assessment-plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateAssessmentPlan(id: string, input: { title?: string; termId?: string; yearGroupId?: string; subjectId?: string; dueAt?: string }) { return request(`/academics/assessment-plans/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveAssessmentPlan(id: string) { return request(`/academics/assessment-plans/${id}/archive`, { method: "POST" }); }
export function assignCurriculumSubject(input: {
  academicYearId: string;
  yearGroupId: string;
  subjectId: string;
  weeklyPeriods: number;
  curriculumId?: string;
}) {
  return request("/academics/curriculum", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateCurriculumSubject(id: string, input: { academicYearId?: string; yearGroupId?: string; subjectId?: string; weeklyPeriods?: number; curriculumId?: string }) { return request(`/academics/curriculum/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveCurriculumSubject(id: string) { return request(`/academics/curriculum/${id}/archive`, { method: "POST" }); }
export function getTimetableOverview() {
  return request<TimetableOverview>("/timetable/overview");
}
export function createTimetableLesson(input: {
  termId: string;
  yearGroupId: string;
  formGroupId?: string;
  subjectId: string;
  staffId?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  periodLabel: string;
  room?: string;
}) {
  return request("/timetable/lessons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateTimetableLesson(
  id: string,
  input: {
    termId: string;
    yearGroupId: string;
    formGroupId?: string;
    subjectId: string;
    staffId?: string;
    weekday: number;
    startsAt: string;
    endsAt: string;
    periodLabel: string;
    room?: string;
  },
) {
  return request(`/timetable/lessons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getAttendanceOverview() {
  return request<AttendanceOverview>("/attendance/overview");
}

export function openAttendanceRegister(input: { timetableSlotId: string; date: string }) {
  return request<AttendanceRegisterDetail>("/attendance/registers", { method: "POST", body: JSON.stringify(input) });
}

export function getAttendanceRegister(id: string) {
  return request<AttendanceRegisterDetail>(`/attendance/registers/${id}`);
}

export function saveAttendanceRegister(id: string, records: Array<{ studentId: string; status: AttendanceCode; note?: string }>, submit = false) {
  return request<AttendanceRegisterDetail>(`/attendance/registers/${id}/${submit ? "submit" : "draft"}`, { method: submit ? "POST" : "PATCH", body: JSON.stringify({ records }) });
}

export function getBehaviourOverview() { return request<BehaviourOverview>("/behaviour/overview"); }
export function getBehaviourReference() { return request<BehaviourReference>("/behaviour/reference"); }
export function createBehaviourCategory(input: object) { return request("/behaviour/categories", { method: "POST", body: JSON.stringify(input) }); }
export function updateBehaviourCategory(id: string, input: object) { return request(`/behaviour/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveBehaviourCategory(id: string) { return request(`/behaviour/categories/${id}/archive`, { method: "POST" }); }
export function createBehaviourEvent(input: object) { return request("/behaviour/events", { method: "POST", body: JSON.stringify(input) }); }
export function updateBehaviourEvent(id: string, input: object) { return request(`/behaviour/events/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveBehaviourEvent(id: string) { return request(`/behaviour/events/${id}/archive`, { method: "POST" }); }
export function createBehaviourReward(input: object) { return request("/behaviour/rewards", { method: "POST", body: JSON.stringify(input) }); }
export function updateBehaviourReward(id: string, input: object) { return request(`/behaviour/rewards/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveBehaviourReward(id: string) { return request(`/behaviour/rewards/${id}/archive`, { method: "POST" }); }
export function createBehaviourSanction(input: object) { return request("/behaviour/sanctions", { method: "POST", body: JSON.stringify(input) }); }
export function updateBehaviourSanction(id: string, input: object) { return request(`/behaviour/sanctions/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function archiveBehaviourSanction(id: string) { return request(`/behaviour/sanctions/${id}/archive`, { method: "POST" }); }
export function createCoverArrangement(input: {
  timetableSlotId: string;
  absentStaffId: string;
  coverStaffId?: string;
  date: string;
  status: "PENDING" | "CONFIRMED";
  note?: string;
}) {
  return request("/timetable/covers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startAdmissionApplication(
  personal: AdmissionFormData["personal"],
) {
  return request<{
    application: AdmissionApplication;
    applicationToken: string;
  }>(
    "/admissions/applications",
    { method: "POST", body: JSON.stringify(personal) },
    false,
  );
}

export function getAdmissionApplication(id: string, token: string) {
  return request<AdmissionApplication>(
    `/admissions/applications/${id}`,
    { headers: { "x-application-token": token } },
    false,
  );
}

export function saveAdmissionSection<K extends AdmissionSection>(
  id: string,
  token: string,
  section: K,
  data: AdmissionFormData[K],
) {
  return request<AdmissionApplication>(
    `/admissions/applications/${id}/sections/${section}`,
    {
      method: "PATCH",
      headers: { "x-application-token": token },
      body: JSON.stringify(data),
    },
    false,
  );
}

export function uploadAdmissionDocument(
  id: string,
  token: string,
  category: string,
  file: File,
) {
  const body = new FormData();
  body.append("category", category);
  body.append("file", file);
  return request<AdmissionApplication["documents"][number]>(
    `/admissions/applications/${id}/documents`,
    { method: "POST", headers: { "x-application-token": token }, body },
    false,
  );
}

export function submitAdmissionApplication(id: string, token: string) {
  return request<AdmissionApplication>(
    `/admissions/applications/${id}/submit`,
    { method: "POST", headers: { "x-application-token": token } },
    false,
  );
}

export function trackAdmissionApplication(input: {
  applicationNumber: string;
}) {
  return request<{
    applicationNumber: string;
    firstName: string;
    lastName: string;
    status: string;
    entryYearGroup?: string;
    entryAcademicYear: string;
    submittedAt?: string;
    updatedAt: string;
  }>(
    "/admissions/track",
    { method: "POST", body: JSON.stringify(input) },
    false,
  );
}

export function getReportsOverview(filters: { academicYearId?: string; termId?: string; yearGroupId?: string; studentId?: string; type?: ReportType } = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return request<ReportsOverview>(`/reports/overview${query.size ? `?${query}` : ""}`);
}

export function generateReport(input: { type: ReportType; name?: string; academicYearId?: string; termId?: string; yearGroupId?: string; studentId?: string }) {
  return request<GeneratedReport>("/reports/generate", { method: "POST", body: JSON.stringify(input) });
}

export function getGeneratedReport(id: string) {
  return request<GeneratedReport>(`/reports/${id}`);
}

export function archiveGeneratedReport(id: string) {
  return request<GeneratedReport>(`/reports/${id}/archive`, { method: "POST" });
}

export async function downloadGeneratedReport(id: string) {
  const headers = new Headers();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}/reports/${id}/download`, { headers, credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, "DOWNLOAD_FAILED", "The report could not be downloaded.");
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "report.csv";
  return { filename, blob: await response.blob() };
}

export function getCommunicationOverview() {
  return request<CommunicationOverview>("/communication/overview");
}

export function createCommunicationThread(input: {
  subject: string;
  type: "DIRECT" | "GROUP";
  channel: "PORTAL" | "EMAIL" | "WHATSAPP";
  recipients: Array<{ type: CommunicationRecipientType; id: string }>;
  body: string;
  saveAsDraft: boolean;
  assisted: boolean;
}) {
  return request<CommunicationThread>("/communication/threads", { method: "POST", body: JSON.stringify(input) });
}

export function sendCommunicationMessage(threadId: string, input: { body: string; saveAsDraft: boolean; assisted: boolean }) {
  return request<CommunicationMessage>(`/communication/threads/${threadId}/messages`, { method: "POST", body: JSON.stringify(input) });
}

export function markCommunicationThreadRead(threadId: string) {
  return request<{ id: string; read: boolean }>(`/communication/threads/${threadId}/read`, { method: "POST" });
}

export function archiveCommunicationThread(threadId: string) {
  return request<CommunicationThread>(`/communication/threads/${threadId}/archive`, { method: "POST" });
}

export function createAnnouncement(input: {
  title: string;
  body: string;
  audience: Announcement["audience"];
  audienceLabel: string;
  priority: Announcement["priority"];
  status: Announcement["status"];
  publishAt?: string;
  expiresAt?: string;
  assisted: boolean;
}) {
  return request<Announcement>("/communication/announcements", { method: "POST", body: JSON.stringify(input) });
}

export function updateAnnouncement(id: string, input: Partial<{
  title: string;
  body: string;
  audience: Announcement["audience"];
  audienceLabel: string;
  priority: Announcement["priority"];
  status: Announcement["status"];
  publishAt: string;
  expiresAt: string;
  assisted: boolean;
}>) {
  return request<Announcement>(`/communication/announcements/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function archiveAnnouncement(id: string) {
  return request<Announcement>(`/communication/announcements/${id}/archive`, { method: "POST" });
}

export function draftCommunicationWithAssistant(input: {
  intent: "MESSAGE" | "ANNOUNCEMENT" | "FOLLOW_UP";
  tone: "WARM" | "FORMAL" | "CONCISE" | "SUPPORTIVE";
  audienceLabel: string;
  context?: { type: string; title: string; details: string };
  instruction?: string;
}) {
  return request<{ subject: string; body: string; source: string }>("/communication/assistant/draft", { method: "POST", body: JSON.stringify(input) });
}

export function getAdminAdmissions(
  filters: {
    search?: string;
    status?: string;
    yearGroup?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 50),
  });
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.yearGroup) query.set("yearGroup", filters.yearGroup);
  return request<AdminAdmissionsResult>(
    `/admissions/admin/applications?${query}`,
  );
}

export function getAdminAdmission(id: string) {
  return request<AdminAdmissionDetail>(`/admissions/admin/applications/${id}`);
}

export function updateAdminAdmission(
  id: string,
  input: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    phone: string;
    entryYearGroup: "YEAR_7" | "YEAR_9" | "YEAR_12";
  },
) {
  return request<AdminAdmissionDetail>(`/admissions/admin/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function transitionAdmission(
  id: string,
  input: {
    targetStatus: AdmissionStatus;
    note?: string;
    scheduledAt?: string;
    score?: number;
  },
) {
  return request<AdminAdmissionDetail>(
    `/admissions/admin/applications/${id}/transition`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function enrolAdmission(
  id: string,
  input: { admissionNumber?: string; startsOn?: string } = {},
) {
  return request<AdminAdmissionDetail>(
    `/admissions/admin/applications/${id}/enrol`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function downloadAdminAdmissionDocument(
  applicationId: string,
  document: AdmissionDocument,
) {
  const headers = new Headers();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(
    `${API_URL}/admissions/admin/applications/${applicationId}/documents/${document.id}`,
    { headers, credentials: "include" },
  );
  if (!response.ok)
    throw new ApiError(
      response.status,
      "DOWNLOAD_FAILED",
      "The document could not be downloaded.",
    );
  const url = URL.createObjectURL(await response.blob());
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.originalName;
  link.click();
  URL.revokeObjectURL(url);
}
