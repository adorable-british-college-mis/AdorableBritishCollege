# Implementation Plan

## 1. Delivery Principles

- Inspect any newly supplied source code before changing it.
- Keep frontend and backend as separate TypeScript applications.
- Build a modular monolith, not microservices.
- Use the PRD as business source of truth.
- Use connected Figma frames as visual source of truth once available.
- Keep the learner/student entity authoritative across all modules.
- Enforce authorization in the backend, not only in React.
- Add tests with each meaningful change.
- Do not use real student data in fixtures.

## 2. Phase 0 - Project Foundation Approval

Before coding Phase 1, confirm these decisions:

- Backend framework: Express or Fastify.
- Auth session model: secure cookie sessions or access/refresh JWT pair.
- Primary key style: UUID recommended.
- Identity provider at launch: local email/password only, Google, Microsoft 365, or both.
- MFA requirement for privileged roles.
- Deployment target and hosting constraints.
- Whether the provided PNGs may be used as interim design references before Figma is connected.

Deliverables after approval:

- `frontend/` React TypeScript app.
- `backend/` Node TypeScript REST API.
- `docker-compose.yml` with PostgreSQL.
- Prisma schema and first migration.
- `.env.example` files.
- baseline lint, type-check, and tests.

## 3. Phase 1 - Foundation

Scope:

- authentication;
- users;
- roles;
- permissions;
- students;
- parents/guardians;
- staff;
- academic years;
- terms;
- subjects;
- audit;
- import foundation;
- security foundation.

Backend deliverables:

- `User`, `Role`, `Permission`, `UserRole`, `RolePermission`.
- `Student`, `ParentGuardian`, `StudentGuardian`, `Staff`.
- `AcademicYear`, `Term`, `YearGroup`, `Subject`.
- secure login/logout/password reset.
- permission policy engine.
- record-scope authorization helpers.
- centralized audit event service.
- CSV import job skeleton with validation report.
- OpenAPI documentation for implemented endpoints.

Frontend deliverables:

- auth layout from supplied design.
- admin shell/sidebar/topbar.
- student shell/sidebar/topbar.
- login page.
- student directory page.
- core student profile shell.
- admin users/roles screens sufficient for initial setup.

Tests:

- login success/failure/rate limit.
- password reset token expiry/consumption.
- parent cannot access another parent's child.
- student cannot access another student's record.
- teacher without assignment cannot access restricted student/class data.
- unauthorized user cannot access safeguarding/SEND/medical placeholders.
- audit events written for privileged operations.

## 4. Phase 2 - Curriculum and Timetable

Scope:

- curriculum structure;
- class/teaching groups;
- periods;
- rooms;
- timetable cycles and versions;
- clash detection.

Deliverables:

- class and membership models with effective dates.
- teacher/class/student/room clash checks.
- timetable views by student, teacher, class, room, and year group.
- mobile-friendly timetable view.
- publication/versioning so changes do not corrupt historical records.

## 5. Phase 3 - Attendance and Behaviour

Scope:

- registers;
- attendance codes;
- attendance records;
- amendments;
- behaviour;
- rewards;
- sanctions;
- pastoral foundation.

Deliverables:

- mobile teacher register workflow.
- attendance summaries and persistent absence thresholds.
- amendment reasons and audit trail.
- behaviour categories with configurable points.
- serious-incident escalation hooks.
- parent notification policy left configurable.
- pastoral notes/intervention foundation with restricted access.

## 6. Phase 4 - Assessment and Reporting

Scope:

- assessments;
- grade scales;
- targets;
- results;
- reports;
- transcripts;
- dashboards.

Deliverables:

- whole-class mark entry.
- CSV result import with validation.
- configurable grade boundaries.
- target vs actual tracking.
- report templates and publication workflow.
- locked published reports with correction/audit process.

## 7. Phase 5 - Exams, Safeguarding, and SEND

Scope:

- examination series;
- exam entries;
- access arrangements;
- safeguarding;
- SEND.

Deliverables:

- restricted safeguarding case module.
- immutable safeguarding chronology.
- SEND plans/provision/reviews.
- minimum necessary teacher-facing SEND information.
- exam entry, clash, seating, access arrangement, and result imports.

## 8. Phase 6 - Portals and Communication

Scope:

- parent portal;
- student portal;
- notifications;
- documents;
- communication history.

Deliverables:

- parent linked-child dashboard.
- student dashboard.
- message templates and delivery statuses.
- document publication/download permissions.
- absence explanation and consent workflows where approved.

## 9. Phase 7 - Operations

Scope:

- admissions;
- finance;
- transport;
- boarding;
- library;
- assets;
- trips/clubs.

Deliverables:

- admissions workflow and applicant-to-student conversion.
- invoices/payments if finance enabled.
- boarding and transport assignments if enabled.
- library loans and asset maintenance if enabled.
- trip consent and participation records.

## 10. Phase 8 - Intelligence and Integrations

Scope:

- analytics;
- external integrations;
- API ecosystem;
- automation.

Deliverables:

- leadership analytics dashboards.
- identity provider integration.
- email/SMS provider integration.
- payment provider integration.
- calendar integration.
- webhook/API integration framework.

## 11. Recommended First Implementation Task

After approval, begin with Phase 0 and the smallest useful Phase 1 vertical slice:

1. scaffold `frontend/` and `backend/`;
2. configure TypeScript strict mode;
3. add Docker Compose PostgreSQL;
4. add Prisma with initial identity, role, permission, student, parent, staff, academic-year, term, subject, and audit models;
5. implement auth, authorization policy skeleton, and audit service;
6. build the branded login page and admin shell from the provided design references;
7. add security tests for role and record isolation.

## 12. Definition of Ready for Phase 1

- Figma frame or selection provided, or approval to use PNG references temporarily.
- Auth/session approach approved.
- Identity provider decision approved.
- MFA policy approved.
- Initial role list approved.
- Core student fields approved.
- Data migration source and expected import format identified.
- Legal/data-protection jurisdiction confirmed for policy configuration.

