export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Adorable British College MIS API",
    version: "1.0.0",
    description: "Versioned REST API for the Adorable British College management information system.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      applicationToken: { type: "apiKey", in: "header", name: "x-application-token" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, requestId: { type: "string", format: "uuid" } } } },
      },
      Student: {
        type: "object",
        required: ["id", "admissionNumber", "firstName", "lastName", "dateOfBirth", "status"],
        properties: {
          id: { type: "string", format: "uuid" }, admissionNumber: { type: "string" }, firstName: { type: "string" }, middleName: { type: ["string", "null"] },
          lastName: { type: "string" }, preferredName: { type: ["string", "null"] }, dateOfBirth: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["APPLICANT", "ACTIVE", "WITHDRAWN", "GRADUATED", "ARCHIVED"] },
        },
      },
    },
  },
  paths: {
    "/dashboard/summary": { get: { summary: "Administrative dashboard summary from live MIS records", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current academic context, learner and admissions aggregates, and recent audit activity" }, "403": { description: "Requires global student, admissions, and audit access" } } } },
    "/auth/login": { post: { summary: "Sign in", responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid credentials" }, "429": { description: "Rate limited" } } } },
    "/auth/refresh": { post: { summary: "Rotate refresh token", responses: { "200": { description: "Session refreshed" }, "401": { description: "Invalid session" } } } },
    "/auth/logout": { post: { summary: "Revoke current session", security: [{ bearerAuth: [] }], responses: { "204": { description: "Signed out" } } } },
    "/auth/me": { get: { summary: "Current user", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current identity and permissions" } } } },
    "/admissions/applications": { post: { summary: "Start a public admissions application", responses: { "201": { description: "Draft created with a one-time application access token" }, "409": { description: "An active application already exists" } } } },
    "/admissions/track": { post: { summary: "Track an application by reference, email, and date of birth", responses: { "200": { description: "Application status" }, "404": { description: "No matching application" } } } },
    "/admissions/applications/{applicationId}": { get: { summary: "Resume a draft application", security: [{ applicationToken: [] }], parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Application draft" }, "403": { description: "Invalid application token" } } } },
    "/admissions/applications/{applicationId}/sections/{section}": { patch: { summary: "Validate and save one admissions section", security: [{ applicationToken: [] }], responses: { "200": { description: "Section saved" }, "400": { description: "Validation error" } } } },
    "/admissions/applications/{applicationId}/documents": { post: { summary: "Upload a private admissions document", security: [{ applicationToken: [] }], responses: { "201": { description: "Document stored" }, "400": { description: "Unsupported or oversized file" } } } },
    "/admissions/applications/{applicationId}/submit": { post: { summary: "Validate and submit a completed application", security: [{ applicationToken: [] }], responses: { "200": { description: "Application submitted and locked" }, "400": { description: "Application incomplete" } } } },
    "/students": {
      get: { summary: "List students in the caller's permitted record scope", security: [{ bearerAuth: [] }], responses: { "200": { description: "Paginated student list" }, "403": { description: "Forbidden" } } },
      post: { summary: "Create a student", security: [{ bearerAuth: [] }], responses: { "201": { description: "Student created" }, "403": { description: "Forbidden" } } },
    },
    "/students/{studentId}": { get: { summary: "Get one student within permitted record scope", security: [{ bearerAuth: [] }], parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Student record" }, "404": { description: "Not found or outside scope" } } } },
    "/students/{studentId}/archive": { post: { summary: "Archive a student without deleting history", security: [{ bearerAuth: [] }], parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Student archived" }, "403": { description: "Forbidden" } } } },
    "/students/stats": { get: { summary: "Student counts in the caller's permitted scope", security: [{ bearerAuth: [] }], responses: { "200": { description: "Student statistics" } } } },
    "/academics/reference": { get: { summary: "Academic years, terms, year groups, and subjects", security: [{ bearerAuth: [] }], responses: { "200": { description: "Academic reference data" } } } },
  },
} as const;
