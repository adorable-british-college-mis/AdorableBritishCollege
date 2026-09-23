# Security Review

## 1. Current Security Posture

No executable application code, backend, database, authentication, authorization, or deployment configuration was found. Therefore, there are no implemented security controls to review.

Current risk level: high until the foundation is implemented, because the PRD includes children's personal data, safeguarding records, SEND records, medical information, finance data, and parent/student portal access.

## 2. Missing Critical Controls

The following controls are required before any real or production-like student data is introduced:

- individual user accounts;
- secure password hashing;
- password reset with hashed, expiring, single-use tokens;
- optional/required MFA for privileged users;
- session/token revocation;
- rate limiting for authentication and sensitive endpoints;
- input validation and output redaction;
- server-side RBAC;
- permission-based authorization;
- row/record-level authorization;
- field-level restrictions;
- audit logging;
- database constraints and foreign keys;
- secure environment secret handling;
- no real student data in development;
- backup and restore process;
- logging and monitoring;
- vulnerability/dependency scanning once dependencies exist.

## 3. Required Authorization Rules

Minimum rules to implement and test:

- Parents can only access children linked through `StudentGuardian`.
- Students can only access their own records.
- Teachers can only access students/classes assigned to them for the relevant academic period.
- Form tutors, heads of year, and pastoral staff can access only their assigned groups unless explicitly elevated.
- Safeguarding records are visible only to DSL/safeguarding-approved personnel and specifically authorized senior leaders.
- SEND records are visible only to authorized SEND staff, with teacher access limited to classroom-relevant support information.
- Medical records are restricted to authorized welfare/medical staff and emergency minimum information where appropriate.
- Finance records are hidden from teachers and students unless explicitly required by role.
- Audit logs are not editable by normal application users.
- Exports are limited to fields permitted by the actor's role and record scope.

## 4. Sensitive Data Areas

Highly restricted:

- safeguarding cases and chronologies;
- SEND plans and support records;
- medical profiles, allergies, medication, and incidents;
- finance/payment details;
- custody/access restrictions;
- admissions interview/decision notes;
- HR records;
- access arrangements for examinations.

Restricted fields should be redacted at the API serialization layer unless the actor has explicit field permission. UI hiding is not sufficient.

## 5. API Security Requirements

Every API route should include:

- authenticated user context where required;
- route-level permission check;
- record-scope check;
- input validation;
- safe structured errors;
- audit event where appropriate;
- rate limiting for sensitive routes;
- pagination limits for list endpoints;
- field redaction before response serialization.

Privileged operations should require explicit audit events:

- role/permission changes;
- user creation/deactivation;
- student core-data changes;
- attendance amendments;
- behaviour corrections/deletions;
- safeguarding/SEND/medical/finance access;
- report publication/correction;
- imports/exports;
- workflow approvals.

## 6. Database Security Requirements

Required controls:

- least-privilege database user for the application;
- foreign keys on all relationships;
- unique constraints for identity fields;
- indexes for security-scope filtering;
- soft archive for historical records;
- transaction boundaries for multi-table changes;
- no hard delete of learners with linked records;
- immutable or tamper-evident audit storage;
- optional PostgreSQL Row Level Security for the most sensitive tables after application policies are established.

## 7. Testing Requirements

Security tests must be implemented before feature completion:

- Parent A cannot access Parent B's child.
- Student A cannot access Student B's records.
- Teacher A cannot access unauthorized classes.
- Unauthorized users cannot access safeguarding cases.
- Unauthorized users cannot access restricted SEND records.
- Unauthorized users cannot access restricted medical records.
- Unauthorized users cannot access finance records.
- Direct API calls cannot bypass permissions hidden in the UI.
- Deactivated users cannot authenticate.
- Password reset tokens cannot be reused.
- Audit events are written for privileged operations.
- Export endpoints redact unauthorized fields.

## 8. Open Security Decisions

These require approval before implementation:

- Which identity provider, if any, is required at launch: Google Workspace, Microsoft 365, both, or local accounts only?
- Which roles require MFA?
- Should privileged actions require step-up authentication?
- What is the session timeout policy?
- Which staff roles may access safeguarding records?
- Which staff roles may access SEND records?
- Which staff roles may access medical records?
- Which parent access restrictions must be represented for custody/legal arrangements?
- Which data-protection jurisdiction and retention rules apply to the school?
- What backup retention, RTO, and RPO targets are required?

## 9. Recommended Security Foundation

Start Phase 1 by building:

- auth module;
- user/role/permission module;
- policy engine;
- request context middleware;
- centralized audit service;
- secure password reset;
- rate limiting;
- validation and error framework;
- authorization test suite.

Do not build sensitive feature modules such as safeguarding, SEND, medical, or finance before this foundation exists.

