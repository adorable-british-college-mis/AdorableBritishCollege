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
    id: string;
    startsOn: string;
    academicYear: { id: string; name: string };
    yearGroup: { id: string; code: string; name: string };
    formGroup?: { id: string; code: string; name: string };
    house?: { id: string; code: string; name: string };
  }>;
  guardians?: Array<{
    relationship: string;
    isPrimaryContact: boolean;
    guardian: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    };
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
  formGroups: Array<{
    id: string;
    code: string;
    name: string;
    yearGroupId: string;
    yearGroup: { id: string; name: string };
  }>;
  houses: Array<{ id: string; code: string; name: string }>;
  departments: AcademicDepartment[];
  curricula: AcademicCurriculum[];
  teachers: AcademicTeacher[];
}

export interface AcademicDepartment {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  archivedAt?: string;
  _count?: { subjects: number; staff: number; formGroups: number };
}

export interface AcademicCurriculum {
  id: string;
  code: string;
  name: string;
  description?: string;
  academicYearId: string;
  yearGroupId?: string;
  isActive: boolean;
  archivedAt?: string;
  academicYear: { id: string; name: string };
  yearGroup: YearGroup | null;
  subjects: Array<{ id: string; subjectId: string; isActive: boolean; subject: Subject }>;
  formGroups: Array<{ id: string; code: string; name: string }>;
}

export interface AcademicTeacher {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department?: string;
  departmentId?: string;
  status: string;
  archivedAt?: string;
  academicDepartment?: AcademicDepartment | null;
  formGroups: Array<{ id: string; code?: string }>;
  teachingAssignments?: Array<{ id: string; formGroup: { id: string; code: string }; subject: Subject; isActive: boolean }>;
}

export interface AcademicOverview {
  academicYear: AcademicYear | null;
  metrics: {
    subjects: number;
    classes: number;
    teachers: number;
    assessmentPlans: number;
    averageProgress: number | null;
  };
  subjects: Array<Subject & { isActive: boolean; archivedAt?: string; departmentId?: string; academicDepartment?: AcademicDepartment | null }>;
  classes: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    archivedAt?: string;
    curriculumId?: string;
    departmentId?: string;
    yearGroup: YearGroup;
    tutor: { id: string; firstName: string; lastName: string } | null;
    curriculum: AcademicCurriculum | null;
    department: AcademicDepartment | null;
    teachingAssignments: Array<{ id: string; isActive: boolean; archivedAt?: string; subject: Subject; staff: AcademicTeacher; department: AcademicDepartment | null }>;
    students: number;
    subjects: number;
    averageProgress: number | null;
  }>;
  teachers: AcademicTeacher[];
  assessments: Array<{
    id: string;
    title: string;
    dueAt: string;
    term: { id: string; name: string };
    yearGroup: YearGroup;
    subject: { id: string; name: string } | null;
    results: Array<{ status: string }>;
    isActive: boolean;
    archivedAt?: string;
  }>;
  curriculum: Array<{
    id: string;
    academicYearId: string;
    yearGroupId: string;
    subjectId: string;
    weeklyPeriods: number;
    academicYear: { id: string; name: string };
    yearGroup: YearGroup;
    subject: Subject;
    curriculum: AcademicCurriculum | null;
    isActive: boolean;
    archivedAt?: string;
  }>;
  curricula: AcademicCurriculum[];
  departments: AcademicDepartment[];
  teachingAssignments: Array<{
    id: string;
    academicYearId: string;
    formGroupId: string;
    subjectId: string;
    staffId: string;
    departmentId?: string;
    isActive: boolean;
    archivedAt?: string;
    formGroup: { id: string; code: string; name: string; yearGroup: YearGroup };
    subject: Subject;
    staff: AcademicTeacher;
    department: AcademicDepartment | null;
  }>;
  performance: Array<{
    id: string;
    name: string;
    displayOrder: number;
    terms: Array<{ termId: string; termName: string; value: number | null }>;
  }>;
  calendar: Array<{ id: string; title: string; date: string; type: string }>;
}

export interface TimetableSlot {
  id: string;
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
  term: { id: string; name: string };
  yearGroup: { id: string; name: string; displayOrder: number };
  formGroup: { id: string; code: string; name: string } | null;
  subject: { id: string; code: string; name: string; department?: string };
  staff: {
    id: string;
    staffNumber: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface TimetableOverview {
  academicYear: AcademicYear | null;
  currentTerm: {
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
  } | null;
  slots: TimetableSlot[];
  periods: Array<{ label: string; startsAt: string; endsAt: string }>;
  covers: Array<{
    id: string;
    date: string;
    status: "PENDING" | "CONFIRMED";
    note?: string;
    timetableSlot: TimetableSlot;
    absentStaff: { id: string; firstName: string; lastName: string };
    coverStaff: { id: string; firstName: string; lastName: string } | null;
  }>;
  metrics: {
    totalClasses: number;
    roomsAssigned: number;
    coverLessonsToday: number;
    conflicts: number;
  };
  todaySchedule: TimetableSlot[];
  reference: {
    yearGroups: YearGroup[];
    formGroups: Array<{
      id: string;
      code: string;
      name: string;
      yearGroupId: string;
      yearGroup: { id: string; name: string };
    }>;
    subjects: Subject[];
    staff: Array<{
      id: string;
      staffNumber: string;
      firstName: string;
      lastName: string;
      jobTitle: string;
    }>;
  };
}

export type AttendanceCode = "PRESENT" | "LATE" | "ABSENT" | "AUTHORISED_ABSENCE" | "UNAUTHORISED_ABSENCE" | "MEDICAL" | "OTHER";

export interface AttendanceRegisterSummary {
  id: string | null;
  date: string;
  timetableSlotId: string;
  periodLabel: string;
  registerType: string;
  status: "OPEN" | "SUBMITTED";
  submittedAt?: string;
  yearGroup: { id: string; name: string };
  formGroup: { id: string; code: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  timetableSlot: TimetableSlot;
  records: Array<{ studentId: string; status: AttendanceCode }>;
  studentCount?: number;
}

export interface AttendanceOverview {
  academicYear: AcademicYear | null;
  currentTerm: { id: string; name: string; startsOn: string; endsOn: string } | null;
  metrics: { present: number; absent: number; late: number; unauthorised: number; rate: number | null };
  registers: AttendanceRegisterSummary[];
  byYearGroup: Array<{ id: string; name: string; percentage: number | null }>;
  week: Array<{ date: string; label: string; percentage: number | null }>;
  alerts: Array<{ id: string; name: string; yearGroup: string; absences: number }>;
  availableLessons: TimetableSlot[];
  exceptions: Array<{
    id: string;
    status: AttendanceCode;
    note?: string;
    markedAt: string;
    date: string;
    periodLabel: string;
    className: string;
    subject: string;
    student: { id: string; admissionNumber: string; firstName: string; lastName: string };
  }>;
}

export interface AttendanceRegisterDetail extends Omit<AttendanceRegisterSummary, "id"> {
  id: string;
  registerType: string;
  students: Array<{
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    preferredName?: string;
    enrollments: Array<{ yearGroup: { name: string }; formGroup: { code: string } | null }>;
    attendance: { status: AttendanceCode; note?: string; markedAt: string } | null;
  }>;
}

export type BehaviourEventType = "POSITIVE" | "INCIDENT";
export type BehaviourEventStatus = "OPEN" | "RESOLVED" | "ESCALATED";

export interface BehaviourCategory {
  id: string; code: string; name: string; type: BehaviourEventType;
  defaultPoints: number; description?: string; isActive: boolean; archivedAt?: string;
}

export interface BehaviourStudent {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  enrollments: Array<{ academicYearId: string; yearGroupId: string; formGroupId?: string; yearGroup: YearGroup; formGroup?: { id: string; code: string; name: string } }>;
}

export interface BehaviourEvent {
  id: string; studentId: string; termId: string; categoryId?: string; staffId?: string; formGroupId?: string;
  type: BehaviourEventType; status: BehaviourEventStatus; summary: string; details?: string;
  location?: string; points: number; occurredAt: string; resolvedAt?: string; archivedAt?: string;
  student: BehaviourStudent; term: { id: string; name: string; academicYear: AcademicYear };
  category?: BehaviourCategory; staff?: { id: string; firstName: string; lastName: string };
  formGroup?: { id: string; code: string; name: string; yearGroup: YearGroup };
}

export interface BehaviourReward {
  id: string; studentId: string; termId: string; staffId?: string; title: string; description?: string;
  points: number; status: "AWARDED" | "REVOKED"; awardedAt: string; archivedAt?: string;
  student: BehaviourStudent; term: { id: string; name: string; academicYear: AcademicYear };
  staff?: { id: string; firstName: string; lastName: string };
}

export interface BehaviourSanction {
  id: string; studentId: string; termId: string; staffId?: string; behaviourEventId?: string;
  type: "DETENTION" | "INTERNAL_EXCLUSION" | "SUSPENSION" | "COMMUNITY_SERVICE" | "REPORT_CARD" | "OTHER";
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED"; title: string; description?: string;
  scheduledFor?: string; completedAt?: string; archivedAt?: string;
  student: BehaviourStudent; term: { id: string; name: string; academicYear: AcademicYear };
  staff?: { id: string; firstName: string; lastName: string };
  behaviourEvent?: { id: string; summary: string; category?: BehaviourCategory };
}

export interface BehaviourReference {
  academicYear: AcademicYear | null;
  students: BehaviourStudent[];
  staff: Array<{ id: string; staffNumber: string; firstName: string; lastName: string; jobTitle: string }>;
  categories: BehaviourCategory[];
  incidentEvents: Array<{ id: string; studentId: string; summary: string; student: { firstName: string; lastName: string }; category?: BehaviourCategory }>;
}

export interface BehaviourOverview {
  academicYear: AcademicYear | null;
  term: { id: string; name: string; startsOn: string; endsOn: string; academicYearId: string } | null;
  events: BehaviourEvent[]; rewards: BehaviourReward[]; sanctions: BehaviourSanction[]; categories: BehaviourCategory[];
  metrics: { eventsToday: number; positivePoints: number; negativePoints: number; activeSanctions: number; detentionsToday: number };
  yearGroupBalance: Array<{ id: string; name: string; order: number; positive: number; negative: number }>;
  topCategories: Array<{ id: string; name: string; type: BehaviourEventType; count: number }>;
  reports: { totalEvents: number; positiveEvents: number; incidents: number; resolvedIncidents: number; resolutionRate: number; monthlyTrend: Array<{ month: string; positive: number; negative: number }> };
}

export type ReportType = "ACADEMIC" | "ATTENDANCE" | "BEHAVIOUR" | "STUDENT" | "EXAM" | "OTHER";

export interface GeneratedReport {
  id: string;
  name: string;
  type: ReportType;
  status: "COMPLETED" | "FAILED";
  academicYearId: string;
  termId?: string | null;
  filters?: { academicYearId?: string; termId?: string | null; yearGroupId?: string | null; studentId?: string | null };
  snapshot: unknown;
  generatedAt: string;
  archivedAt?: string | null;
  generatedBy: { firstName: string; lastName: string };
  term?: { id: string; name: string } | null;
}

export interface ReportsOverview {
  academicYear: AcademicYear & { terms: Array<{ id: string; name: string; startsOn: string; endsOn: string }> };
  term: { id: string; name: string; startsOn: string; endsOn: string } | null;
  metrics: {
    totalStudents: number;
    reportsGenerated: number;
    attendanceRate: number | null;
    behaviourIncidents: number;
    trends: { totalStudents: number | null; reportsGenerated: number | null; attendanceRate: number | null; behaviourIncidents: number | null };
  };
  academicPerformance: Array<{ id: string; name: string; subjects: Array<{ subject: string; value: number | null }> }>;
  attendanceByYearGroup: Array<{ id: string; name: string; percentage: number | null }>;
  reportTrends: Array<{ key: string; label: string; count: number }>;
  reportDistribution: Array<{ type: ReportType; count: number }>;
  recentReports: GeneratedReport[];
  reference: {
    academicYears: Array<AcademicYear & { terms: Array<{ id: string; name: string; startsOn: string; endsOn: string }> }>;
    yearGroups: YearGroup[];
    students: Array<{ id: string; admissionNumber: string; firstName: string; lastName: string; enrollments: Array<{ yearGroupId: string; yearGroup: { id: string; name: string } }> }>;
  };
}

export type CommunicationRecipientType = "STUDENT" | "GUARDIAN" | "STAFF" | "USER";
export type CommunicationChannel = "PORTAL" | "EMAIL" | "WHATSAPP";

export interface CommunicationParticipant {
  id: string;
  type: CommunicationRecipientType;
  entityId: string;
  displayName: string;
  roleLabel: string;
  email?: string | null;
  phone?: string | null;
  readAt?: string | null;
}

export interface CommunicationMessage {
  id: string;
  threadId: string;
  senderUserId?: string | null;
  senderParticipantId?: string | null;
  body: string;
  status: "DRAFT" | "SENT" | "DELIVERED" | "QUEUED" | "FAILED";
  assisted: boolean;
  sentAt?: string | null;
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string } | null;
  senderParticipant?: CommunicationParticipant | null;
  deliveries: Array<{
    id: string;
    channel: CommunicationChannel;
    status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
    provider: string;
    providerId?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
    deliveredAt?: string | null;
    participant: CommunicationParticipant;
  }>;
}

export interface CommunicationThread {
  id: string;
  subject: string;
  type: "DIRECT" | "GROUP";
  channel: CommunicationChannel;
  lastMessageAt: string;
  createdAt: string;
  participants: CommunicationParticipant[];
  messages: CommunicationMessage[];
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: { type: "ALL" | "STUDENTS" | "GUARDIANS" | "STAFF" | "YEAR_GROUP" | "CUSTOM"; ids: string[] };
  audienceLabel: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: "DRAFT" | "PUBLISHED";
  publishAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  assisted: boolean;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

export interface CommunicationOverview {
  academicYear: AcademicYear | null;
  currentTerm: { id: string; name: string } | null;
  threads: CommunicationThread[];
  announcements: Announcement[];
  liveEvents: Array<{
    id: string;
    type: "ATTENDANCE" | "BEHAVIOUR" | "ADMISSIONS" | "ACADEMIC";
    severity: "HIGH" | "MEDIUM" | "INFO";
    title: string;
    detail: string;
    occurredAt: string;
    recipients: Array<{ type: CommunicationRecipientType; id: string }>;
  }>;
  stats: { messagesSent: number; announcements: number; groupChats: number; queuedEmails: number; drafts: number };
  providers: {
    email: { configured: boolean; provider: string; webhookConfigured: boolean };
    whatsapp: { configured: boolean; provider: string; webhookConfigured: boolean };
  };
  reference: {
    students: Array<{ id: string; firstName: string; lastName: string; email?: string | null; admissionNumber: string; enrollments: Array<{ yearGroup: { id: string; name: string } }> }>;
    guardians: Array<{ id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null }>;
    staff: Array<{ id: string; firstName: string; lastName: string; jobTitle: string; user?: { email: string } | null }>;
    yearGroups: Array<{ id: string; name: string }>;
  };
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
  guardian: {
    firstName: string;
    lastName: string;
    relationship: string;
    email?: string;
    phone?: string;
  };
}

export interface DashboardSummary {
  academicYear: AcademicYear | null;
  currentTerm: {
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
  } | null;
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
  attendance: {
    present: number;
    authorisedAbsence: number;
    unauthorisedAbsence: number;
    total: number;
    percentage: number | null;
    trendPct: number | null;
    week: Array<{ date: string; label: string; percentage: number | null }>;
  };
  assessment: {
    completed: number;
    inProgress: number;
    notStarted: number;
    total: number;
    completionPct: number | null;
    trendPct: number | null;
    byYearGroup: Array<{
      name: string;
      displayOrder: number;
      attainment: number | null;
      progress: number | null;
    }>;
  };
  behaviour: {
    total: number;
    positive: number;
    incidents: number;
    unresolved: number;
    positivePct: number | null;
    incidentsPct: number | null;
  };
  schedule: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    periodLabel: string;
    room?: string;
    subject: { name: string };
    yearGroup: { name: string };
  }>;
  alerts: {
    openRegisters: number;
    assessmentsDueToday: number;
    unresolvedBehaviour: number;
    other: number;
  };
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
