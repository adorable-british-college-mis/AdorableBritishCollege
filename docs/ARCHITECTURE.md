# Adorable British College MIS Architecture

## 1. Inspection Summary

Current repository state after extracting `ABC PROJECTS.zip`:

- Application source code: not present.
- Git repository: not present in `C:\Users\OIdris\adorable-british-college-mis`.
- Frontend framework: not detected.
- Backend framework: not detected.
- Programming languages: not detected.
- Database: not detected.
- ORM: not detected.
- Authentication mechanism: not detected.
- Authorization/RBAC implementation: not detected.
- API structure: not detected.
- Database models/migrations: not detected.
- Environment configuration: not detected.
- Tests: not detected.
- Docker configuration: not detected.
- Package dependencies: not detected.

The provided archive contains 25 PNG design/reference screens, including student login, student dashboard, student attendance, student assessment, documents, messages, examinations, homework/resources, and admin dashboards for students, admissions, timetable, attendance, and behaviour.

## 2. Source Material

The PRD defines the learner/student as the authoritative hub of the system. All academic, pastoral, operational, financial, safeguarding, SEND, attendance, behaviour, assessment, and portal records must reference the same learner identity.

The supplied PNG files provide useful UI direction:

- Full-screen student login with ABC branding and school imagery.
- Dark left navigation shell for admin and student portals.
- White content canvas with muted blue/navy text, burgundy primary actions, rounded cards, status pills, tables, quick actions, and dashboard summaries.
- Admin module coverage for students, admissions, timetable, attendance, and behaviour.
- Student module coverage for dashboard, attendance, assessment, examinations, documents, messages, and resources.

The existing Figma file has not yet been connected. Once provided, it should become the visual source of truth over the PNG screenshots.

## 3. Recommended Repository Structure

Unless a future source-code handoff provides a strong reason otherwise, use the requested modular monolith structure:

```text
/
  frontend/
    src/
      app/
      assets/
      components/
      features/
      layouts/
      lib/
      routes/
      styles/
      test/
  backend/
    prisma/
      schema.prisma
      migrations/
      seed/
    src/
      config/
      db/
      modules/
      common/
      middleware/
      security/
      audit/
      jobs/
      docs/
      tests/
  docs/
  docker-compose.yml
  README.md
```

Frontend and backend should remain separate TypeScript applications in one repository. Do not introduce microservices at this stage; the PRD fits a modular monolith with strong internal module boundaries.

## 4. Target Technology Stack

Recommended stack:

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, a shared component system, and responsive CSS.
- Backend: Node.js, TypeScript, Express or Fastify, REST API, Zod validation, OpenAPI documentation.
- Database: PostgreSQL.
- ORM: Prisma.
- Authentication: secure email/password plus optional identity-provider login; password hashing with Argon2id or bcrypt.
- Authorization: role-based and permission-based checks enforced server-side, with record-scope and field-level rules.
- Sessions/tokens: secure HTTP-only cookies or short-lived access tokens plus refresh-token rotation.
- Testing: Vitest/Jest for unit tests, Supertest or equivalent for API integration tests, Playwright for critical frontend flows.
- Infrastructure: Docker Compose for local PostgreSQL and app services.

## 5. Backend Module Architecture

Use `backend/src/modules` with domain-oriented modules:

```text
auth/
users/
roles/
students/
parents/
staff/
academics/
curriculum/
timetable/
attendance/
behaviour/
pastoral/
safeguarding/
send/
assessment/
examinations/
reports/
portals/
admissions/
finance/
boarding/
transport/
trips/
medical/
library/
assets/
communication/
calendar/
workflow/
import-export/
integrations/
audit/
```

Each module should expose:

- route/controller layer for HTTP concerns;
- service layer for business rules;
- repository/data layer for Prisma queries;
- validation schemas;
- authorization policies;
- tests.

Shared cross-cutting services:

- `common/errors` for structured API errors;
- `common/pagination` for list pagination;
- `security/policies` for permission and row-scope checks;
- `audit/audit.service.ts` for centralized audit events;
- `db/transaction.ts` for transaction boundaries;
- `middleware/request-context.ts` for request ID, user, IP/device metadata, and correlation context.

## 6. Frontend Architecture

Recommended frontend shape:

```text
frontend/src/
  app/
  layouts/
    AuthLayout.tsx
    AdminShell.tsx
    StudentShell.tsx
    ParentShell.tsx
  components/
    ui/
    data-table/
    forms/
    navigation/
    status/
  features/
    auth/
    students/
    admissions/
    timetable/
    attendance/
    behaviour/
    assessment/
    reports/
    portals/
  lib/
    api-client.ts
    auth.ts
    permissions.ts
    query.ts
```

Keep business logic out of React components. UI permission checks should improve usability, but backend authorization remains authoritative.

Reusable UI patterns from the supplied screens:

- branded auth layout with school imagery;
- portal/admin sidebar shell;
- top search and notification bar;
- dashboard metric cards;
- table with filters, pagination, status pills, and row action menu;
- quick-action panels;
- module-specific dashboard cards;
- student timetable and subject-grade panels;
- messages/documents/exam list layouts.

## 7. Proposed Database and Domain Model

Use stable UUID primary keys unless the school requires human-readable numeric IDs. Human-facing identifiers such as admission number, staff code, invoice number, candidate number, and application number should be unique fields separate from primary keys.

Core identity and access:

- `User`: login identity, email, password hash, status, MFA status, timestamps.
- `Role`: named role.
- `Permission`: granular action/resource permission.
- `UserRole`: user-role mapping.
- `RolePermission`: role-permission mapping.
- `UserSession`: refresh/session tokens, device metadata, expiry, revocation.
- `PasswordResetToken`: hashed token, expiry, consumed timestamp.

People and learner hub:

- `Student`: authoritative learner record; admission number, names, DOB, gender, nationality, photo, status, archive metadata.
- `ParentGuardian`: reusable family/contact record.
- `StudentGuardian`: many-to-many relationship, contact priority, relationship, custody/access restrictions, primary contact.
- `Staff`: employee/teacher record linked optionally to a `User`.
- `EmergencyContact`: linked to student.
- `Document`: polymorphic controlled document metadata.

Academic structure:

- `AcademicYear`
- `Term`
- `YearGroup`
- `House`
- `FormGroup`
- `Department`
- `Subject`
- `CurriculumPathway`
- `Enrollment`
- `ClassGroup` / teaching group
- `ClassStudent`
- `ClassTeacher`
- `Room`
- `Period`
- `TimetableCycle`
- `TimetableSlot`
- `TimetablePublication`

Attendance and behaviour:

- `AttendanceCode`
- `AttendanceRegister`
- `AttendanceRecord`
- `AttendanceAmendment`
- `BehaviourCategory`
- `BehaviourEvent`
- `BehaviourAction`
- `Reward`
- `Sanction`

Assessment, exams, reports:

- `AssessmentPeriod`
- `Assessment`
- `GradeScale`
- `GradeBoundary`
- `AssessmentResult`
- `TargetGrade`
- `ReportTemplate`
- `StudentReport`
- `Qualification`
- `ExamSeries`
- `ExamEntry`
- `ExamResult`
- `ExamAccessArrangement`

Restricted welfare:

- `SafeguardingCase`
- `SafeguardingChronologyEvent`
- `SafeguardingReferral`
- `SENDPlan`
- `SENDProvision`
- `MedicalProfile`
- `MedicalIncident`
- `PastoralNote`
- `PastoralIntervention`

Operations:

- `AdmissionApplication`
- `AdmissionWorkflowEvent`
- `Invoice`
- `Payment`
- `BoardingRecord`
- `TransportRoute`
- `TransportAssignment`
- `Trip`
- `Club`
- `LibraryItem`
- `LibraryLoan`
- `Asset`
- `MaintenanceRequest`

Communication and governance:

- `Communication`
- `CommunicationRecipient`
- `NotificationPreference`
- `CalendarEvent`
- `WorkflowInstance`
- `WorkflowStep`
- `ImportJob`
- `ExportJob`
- `AuditEvent`

## 8. Database Rules

Required database-level safeguards:

- Unique `Student.admissionNumber`.
- Unique normalized `User.email`.
- Unique assessment result identity per configured assessment/student/class/subject.
- Foreign keys for all learner-linked records.
- Indexes on student status, year group, form group, class membership, attendance date, behaviour date, assessment period, safeguarding case status, invoice status, and audit timestamp.
- Soft archive for students, parents, staff, documents, classes, and records with history.
- No hard deletion of students with linked historical records.
- Version/effective-date model for enrollments, timetable, curriculum, class membership, and report publication.
- Immutable or tamper-evident audit records outside normal user edit flows.

PostgreSQL Row Level Security may be considered for highly sensitive tables, but it should complement, not replace, application-level authorization.

## 9. API Architecture

Use versioned REST endpoints:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/students
/api/v1/parents
/api/v1/staff
/api/v1/academics
/api/v1/curriculum
/api/v1/timetable
/api/v1/attendance
/api/v1/behaviour
/api/v1/pastoral
/api/v1/safeguarding
/api/v1/send
/api/v1/assessments
/api/v1/examinations
/api/v1/reports
/api/v1/admissions
/api/v1/finance
/api/v1/communication
/api/v1/calendar
/api/v1/imports
/api/v1/exports
/api/v1/audit
```

All list endpoints should support pagination, filtering, sorting, and structured errors. Sensitive endpoints must return only fields permitted for the current actor and record scope.

## 10. Security Architecture

Security must be enforced at API/service/database scope and represented in the UI. Required controls:

- individual accounts only;
- secure password hashing;
- secure reset tokens;
- MFA for privileged roles;
- rate limiting for auth and sensitive APIs;
- input validation for every request;
- server-side RBAC and permission checks;
- row-scope checks for parent/student/teacher access;
- field-level redaction for safeguarding, SEND, medical, finance, and identity data;
- audit logging for privileged operations and sensitive access;
- least privilege default roles;
- session timeout and token revocation;
- secret management through environment variables or a secret manager;
- no real student data in development/test fixtures.

## 11. Audit Architecture

Centralize audit event creation in a backend audit service. Audit events should include:

- actor user ID;
- action;
- entity type;
- entity ID;
- timestamp;
- request/correlation ID;
- before/after metadata where appropriate;
- IP/device metadata where legally and technically appropriate;
- sensitivity marker;
- result status.

Audit these events at minimum:

- login/logout/failed authentication;
- record create/update/archive;
- permission changes;
- role assignments;
- sensitive record access;
- report publication/correction;
- exports/imports;
- approvals;
- attendance amendments;
- behaviour corrections/deletions;
- safeguarding, SEND, medical, and finance access.

## 12. Deployment Architecture

Initial local development:

- `docker-compose.yml` with PostgreSQL, backend, frontend, and optional mail/SMS stubs.
- `.env.example` files for frontend and backend.
- Prisma migrations version-controlled.
- Seed data must be synthetic.

Production target:

- managed PostgreSQL;
- HTTPS only;
- centralized logging and error monitoring;
- automated daily backups with restore tests;
- environment-specific secrets;
- health checks and uptime monitoring.

## 13. Operational Dashboard Read Model

Dashboard metrics are calculated from authoritative operational records rather than stored display totals. Attendance percentages use attendance records, assessment completion and performance use assessment results, behaviour totals use behaviour events, and the schedule uses timetable slots. Admissions pipeline and source summaries are derived from admissions records.

The API returns `null` when a percentage or comparison has no valid denominator or historical baseline. The frontend presents that state as an em dash instead of inventing a percentage. Configured Years 7–12 remain visible in comparative charts even when a year group currently has no records.

The normalized operational tables were introduced in migration `20260923110500_dashboard_operational_metrics`. Aggregate values must not be edited directly; changes flow through their owning domain records and are reflected in the dashboard on the next query refresh.

Student registration is an atomic domain operation. It creates the authoritative `Student`, current `Enrollment`, primary `ParentGuardian`, and `StudentGuardian` link in one database transaction. `FormGroup` and `House` are academic reference entities rather than UI constants, and an enrolment may link to each. Contact and address fields belong to the learner record while guardian contact details remain on the guardian entity. Migration `20260923153500_student_registration_details` introduces this structure.

