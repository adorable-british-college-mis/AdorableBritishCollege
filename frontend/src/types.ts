export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender: "FEMALE" | "MALE" | "OTHER" | "NOT_STATED";
  nationality?: string;
  title?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  townCity?: string;
  postcode?: string;
  photoUrl?: string;
  status: "APPLICANT" | "ACTIVE" | "WITHDRAWN" | "GRADUATED" | "ARCHIVED";
  attendancePercentage: number | null;
  enrollments: Array<{
    startsOn: string;
    yearGroup: { id: string; code: string; name: string };
    formGroup?: { id: string; code: string; name: string };
    house?: { id: string; code: string; name: string };
  }>;
}

export interface StudentStats {
  active: number;
  applicants: number;
  archived: number;
  total: number;
}

export interface AcademicYear {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  terms?: Array<{ id: string; name: string; startsOn: string; endsOn: string }>;
}

export interface YearGroup {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
}

export interface AcademicReference {
  academicYears: AcademicYear[];
  yearGroups: YearGroup[];
  subjects: Subject[];
  formGroups: Array<{ id: string; code: string; name: string; yearGroupId: string; yearGroup: { id: string; name: string } }>;
  houses: Array<{ id: string; code: string; name: string }>;
}

export interface CreateStudentInput {
  admissionNumber: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender: "FEMALE" | "MALE" | "OTHER" | "NOT_STATED";
  nationality?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  townCity?: string;
  postcode?: string;
  yearGroupId: string;
  academicYearId: string;
  formGroupId?: string;
  houseId?: string;
  enrolmentDate: string;
  status: "APPLICANT" | "ACTIVE";
  guardian: { firstName: string; lastName: string; relationship: string; email?: string; phone?: string };
}

export interface DashboardSummary {
  academicYear: AcademicYear | null;
  currentTerm: { id: string; name: string; startsOn: string; endsOn: string } | null;
  students: StudentStats & {
    newThisTerm: number;
    guardians: number;
    staff: number;
    trendPct: number | null;
    byYearGroup: Array<{ name: string; displayOrder: number; count: number }>;
  };
  admissions: {
    total: number;
    submitted: number;
    inReview: number;
    interview: number;
    offered: number;
    accepted: number;
    waitlisted: number;
    enrolled: number;
  };
  attendance: { present: number; authorisedAbsence: number; unauthorisedAbsence: number; total: number; percentage: number | null; trendPct: number | null; week: Array<{ date: string; label: string; percentage: number | null }> };
  assessment: { completed: number; inProgress: number; notStarted: number; total: number; completionPct: number | null; trendPct: number | null; byYearGroup: Array<{ name: string; displayOrder: number; attainment: number | null; progress: number | null }> };
  behaviour: { total: number; positive: number; incidents: number; unresolved: number; positivePct: number | null; incidentsPct: number | null };
  schedule: Array<{ id: string; startsAt: string; endsAt: string; periodLabel: string; room?: string; subject: { name: string }; yearGroup: { name: string } }>;
  alerts: { openRegisters: number; assessmentsDueToday: number; unresolvedBehaviour: number; other: number };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    outcome: "SUCCESS" | "FAILURE";
    createdAt: string;
    actor?: { firstName: string; lastName: string };
  }>;
}
