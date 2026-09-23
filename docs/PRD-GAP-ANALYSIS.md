# PRD Gap Analysis

## 1. Current Implementation Status

No executable application code was found in the workspace or supplied zip archive. The repository currently contains design/reference PNG files only. Therefore, no PRD module is complete in implementation terms.

Current reusable material:

- ABC brand/logo imagery from the provided screenshots.
- Student login screen direction.
- Student portal dashboard direction.
- Admin dashboard/navigation direction.
- Admin screens for students, admissions, timetable, attendance, and behaviour.
- Student screens for attendance, assessment, documents, messages, examinations, and resources.

Current non-existent implementation areas:

- frontend application;
- backend application;
- database schema;
- authentication;
- authorization;
- API routes;
- tests;
- Docker setup;
- migrations;
- environment configuration;
- CI/CD.

## 2. Module-by-Module PRD Map

| PRD module | Existing evidence | Status | Gap |
| --- | --- | --- | --- |
| Authentication | Student login PNG | Partial design only | No auth backend, sessions, password reset, MFA, rate limiting, or UI implementation |
| Users | None | Missing | Need user identity model, lifecycle, status, session management |
| Roles and permissions | Admin UI implies roles; PRD defines roles | Missing | Need RBAC, permissions, row/field policies, tests |
| Students/Learners | Admin Students PNG | Partial design only | Need authoritative learner model, profile, enrollment, archive, import/export |
| Parents/Guardians | PRD only | Missing | Need shared guardian records, sibling links, portal isolation |
| Staff | Admin navigation only | Missing | Need staff profile, user link, teaching allocations, HR/access termination |
| Academic years and terms | PRD only | Missing | Need academic calendar model and admin UI |
| Curriculum | Academics nav only | Missing | Need key stages, pathways, option blocks, qualification metadata |
| Subjects | PRD and dashboard examples | Missing | Need subject model, departments, grade settings |
| Classes/Teaching groups | Timetable/student dashboard examples | Missing | Need class groups, class membership, teacher assignment |
| Timetable | Admin Timetable PNG, student timetable panel | Partial design only | Need periods, rooms, cycles, versions, clash checks, cover/substitution |
| Attendance | Admin and student attendance PNGs | Partial design only | Need registers, codes, amendments, summaries, parent visibility |
| Assessment | Student assessment PNGs | Partial design only | Need assessments, results, grade scales, targets, moderation |
| Results | Student dashboard grades | Partial design only | Need result records, reporting, access controls |
| Examinations | Examination PNG | Partial design only | Need exam series, entries, seating, access arrangements, results |
| Behaviour and rewards | Admin Behaviour PNG | Partial design only | Need events, categories, points, rewards, sanctions, audit trail |
| Pastoral care | Sidebar item only | Missing | Need pastoral notes, interventions, restricted access |
| Safeguarding | Sidebar item only | Missing | Need restricted cases, chronology, referrals, access audit |
| SEND/Learning support | Sidebar item only | Missing | Need support plans, provision, minimum necessary teacher view |
| Student reports | PRD only | Missing | Need templates, comments, PDF generation, publication, locking |
| Parent portal | PRD only | Missing | Need linked-child-only dashboard and communications |
| Student portal | Student dashboard/screens | Partial design only | Need implemented portal and policy-aware data access |
| Admissions | Admin Admissions PNGs | Partial design only | Need application workflow, duplicate prevention, conversion to learner |
| Finance and fees | Sidebar item only | Missing | Need invoices, payments, adjustments, restricted access |
| Boarding | Student sidebar item only | Missing | Need boarding houses, room history, roll calls, incidents |
| Transport | Student sidebar item only | Missing | Need routes, stops, vehicles, assignments, incidents |
| Trips/activities/clubs | PRD only | Missing | Need events, consents, participation, payments if enabled |
| Medical/welfare | PRD only | Missing | Need restricted medical profile, incidents, medication workflow |
| Library | Student sidebar item only | Missing | Need catalogue, loans, returns, overdue notifications |
| Assets/facilities | PRD only | Missing | Need asset register, room/facility register, maintenance |
| Communication/notifications | Messages PNG and admin nav | Partial design only | Need messages, templates, channels, delivery status, preferences |
| Calendar | Dashboard events | Partial design only | Need academic calendar, role-specific views, integrations |
| Dashboards | Multiple dashboard PNGs | Partial design only | Need real metrics, secure queries, drilldowns |
| Reporting | Admin Reports nav | Missing | Need report catalogue, filters, exports, restricted reporting |
| Audit | PRD only | Missing | Need centralized immutable/tamper-evident audit service |
| Integrations | Google login button in design | Partial design only | Need approved identity/email/SMS/payment/calendar/API integrations |
| Import/export | Import Students button in design | Partial design only | Need validation, duplicate detection, review, audit, rollback strategy |
| Workflow/approval engine | PRD only | Missing | Need generic approval states, chains, reminders, segregation rules |

## 3. Existing Database Architecture

No database schema, ORM model, migration, seed, or database configuration was found.

Required direction:

- PostgreSQL with Prisma.
- Authoritative `Student` table as central learner identity.
- Historical records preserved through soft archive/effective dates.
- Foreign keys for all learner-linked records.
- Versioned migrations.
- Database constraints for unique admission numbers, emails, class memberships, assessment uniqueness, and invoice/payment integrity.

## 4. Existing Authentication and Authorization

No implementation found.

Required direction:

- Individual user accounts only.
- Secure password hash storage.
- Optional Google/Microsoft identity provider after approval.
- Server-side RBAC and permission checks.
- Record-level authorization:
  - parents only linked children;
  - students only own records;
  - teachers only assigned classes/students;
  - safeguarding only specifically authorized personnel.
- Field-level redaction for safeguarding, SEND, medical, finance, identity, and HR records.

## 5. Existing Security Mechanisms

No security implementation found.

Immediate required security foundation:

- authentication and session/token design;
- password reset flow;
- MFA decision for privileged roles;
- backend authorization middleware and policies;
- rate limiting;
- request validation;
- audit logging;
- structured error handling without sensitive leakage;
- environment secret management;
- synthetic test data only.

## 6. Architectural Risks

- The workspace does not contain an existing application, so any future code handoff must be inspected before implementation begins.
- The PNG archive is useful but cannot fully replace the Figma source of truth for exact typography, spacing, color tokens, variants, and responsive behavior.
- The scope is broad; trying to implement all modules at once would create security and data-model risk.
- Safeguarding, SEND, medical, finance, and parent access require strong policy decisions before build-out.
- Without early database design discipline, disconnected student records could emerge across modules.
- Admissions, finance, boarding, transport, and integrations are configurable/optional and should not be hard-coded into a single school policy.

## 7. Functionality to Preserve

No working application functionality exists in the inspected workspace.

Design intent to preserve:

- ABC branding and school imagery.
- Burgundy primary action color and navy sidebar.
- Separate admin and student portal shells.
- Dashboard-first navigation.
- Fast teacher/admin workflows via quick actions and searchable tables.
- Learner archive principle shown in the student admin screen.
- Student-facing timetable, grades, attendance, announcements, and documents structure.

## 8. Major Missing Capabilities

All executable capabilities are missing. The first implementation must establish foundation before feature modules:

- repository scaffolding;
- TypeScript strict configuration;
- PostgreSQL and Prisma;
- auth/users/roles/permissions;
- student/parent/staff core domain;
- audit service;
- authorization policy framework;
- frontend shell and design system;
- testing framework.

