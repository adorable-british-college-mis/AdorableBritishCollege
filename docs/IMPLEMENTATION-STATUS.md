# Implementation Status

## Foundation Increment

Implemented on 23 September 2026:

- React and TypeScript frontend with strict type checking.
- Node.js, Express, and TypeScript REST API.
- PostgreSQL and Prisma schema with a version-controlled initial migration.
- Authoritative `Student` identity linked to guardians, users, staff assignments, enrollment, academic years, and year groups.
- Users, roles, granular permissions, rotating refresh sessions, and password hashing.
- Server-side global, self, linked-guardian, and assigned-staff learner scopes.
- Central audit event storage for login, logout, student creation, and student archival.
- Request correlation IDs, secure headers, strict CORS, structured errors, input validation, and authentication rate limiting.
- Versioned `/api/v1` routes and an OpenAPI document at `/api/v1/openapi.json`.
- Branded responsive login, protected admin shell, dashboard, and searchable student directory.
- Synthetic seed data only.
- Baseline API, authorization-scope, and frontend permission tests.

## Public Admissions Increment

Implemented on 23 September 2026:

- Public admissions page as the default application entry point.
- Eight-step British-school application journey: personal details, entry, guardians, academic background, medical/welfare, emergency contacts, supporting documents, and declaration.
- PostgreSQL-backed application drafts with hashed recovery tokens and applicant reference numbers.
- Private PDF/JPG/PNG document uploads with MIME allow-listing and 5 MB limits.
- Required passport photograph, identity document, and recent school report before final submission.
- Applicant status tracking using application number, email, and date of birth.
- Duplicate active-application prevention and submitted-record locking.
- Audit events for application creation, section saves, document uploads, and submission.
- Responsive desktop, tablet, and mobile layouts based on the supplied admissions reference.
- Isolated PostgreSQL integration test covering the complete public admissions workflow.

## Intentionally Deferred

The following remain scheduled according to `IMPLEMENTATION-PLAN.md`:

- production email provider and password-reset delivery;
- MFA and external identity providers;
- admin user/role management screens;
- teaching groups and full timetable;
- attendance, behaviour, assessment, examinations, reports, and portals;
- safeguarding, SEND, medical, finance, and other restricted modules;
- import execution and review screens;
- production deployment, backups, monitoring, and retention policy.

These modules must not be represented as complete until their backend policies, tests, and data model are implemented.

## Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 10 tests, including a complete database-backed admissions journey.
- `npm run build`: passed.
- `npm audit --json`: zero known vulnerabilities.
- Desktop login visual capture: passed at 1440 x 1000.

The application is connected to local PostgreSQL 18 at `localhost:5433/adorablems`. Both migrations are applied and synthetic development data has been seeded. The isolated integration suite uses `adorablems_test`.
