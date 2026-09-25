import { unlink } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../db/prisma.js";

describe("public admissions journey", () => {
  const applicationIds: string[] = [];
  const studentIds: string[] = [];
  const guardianIds: string[] = [];

  afterEach(async () => {
    for (const id of applicationIds.splice(0)) {
      const documents = await prisma.admissionDocument.findMany({ where: { applicationId: id }, select: { storedName: true } });
      await prisma.admissionApplication.deleteMany({ where: { id } });
      await Promise.all(documents.map((document) => unlink(join(process.cwd(), "storage", "admissions", document.storedName)).catch(() => undefined)));
    }
    if (studentIds.length) {
      await prisma.studentGuardian.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.enrollment.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.student.deleteMany({ where: { id: { in: studentIds.splice(0) } } });
    }
    if (guardianIds.length) await prisma.parentGuardian.deleteMany({ where: { id: { in: guardianIds.splice(0) } } });
  });

  it("creates, completes, submits and tracks an application", async () => {
    const uniqueEmail = `family-${Date.now()}@example.test`;
    const personal = {
      legalFirstName: "Amina", legalLastName: "Cole", preferredName: "Mina", dateOfBirth: "2014-02-12",
      gender: "FEMALE", nationality: "Nigerian", countryOfBirth: "Nigeria", religion: "",
      firstLanguage: "English", additionalLanguages: "Yoruba", applicantEmail: uniqueEmail, applicantPhone: "+2348000000000",
    };
    await request(app).post("/api/v1/admissions/applications").send({ ...personal, gender: "OTHER" }).expect(400);
    const started = await request(app).post("/api/v1/admissions/applications").send(personal).expect(201);
    const id = started.body.data.application.id as string;
    const token = started.body.data.applicationToken as string;
    const applicationNumber = started.body.data.application.applicationNumber as string;
    applicationIds.push(id);
    const headers = { "x-application-token": token };

    const sections = {
      entry: { academicYear: "2026/2027", yearGroup: "YEAR_7", entryTerm: "AUTUMN", pupilType: "DAY", currentSchoolYear: "Year 6", proposedStartDate: "2026-09-08", scholarshipInterest: true, scholarshipNotes: "Retired field" },
      guardians: {
        primaryGuardian: { title: "MRS", firstName: "Grace", lastName: "Cole", relationship: "MOTHER", parentalResponsibility: true, email: uniqueEmail, phone: "+2348000000000", alternatePhone: "", occupation: "Engineer", livesWithApplicant: true, preferredContactMethod: "EMAIL", address: { line1: "1 Test Avenue", line2: "", city: "Lagos", countyState: "Lagos", postcode: "", country: "Nigeria" } },
        addSecondGuardian: false,
        secondGuardian: { title: "MRS", firstName: "", lastName: "", relationship: "MOTHER", parentalResponsibility: true, email: "", phone: "", alternatePhone: "", occupation: "", livesWithApplicant: true, preferredContactMethod: "EMAIL", address: { line1: "", line2: "", city: "", countyState: "", postcode: "", country: "Nigeria" } },
        custodyOrAccessRestrictions: false, restrictionDetails: "",
      },
      academic: { previousSchoolName: "Example Preparatory School", previousSchoolAddress: "Lagos", previousSchoolCountry: "Nigeria", attendanceFrom: "2020-09-01", attendanceTo: "", curriculum: "NIGERIAN_BRITISH_BLEND", currentYearGroup: "Year 6", reasonForLeaving: "ACADEMIC_PROGRESSION", headteacherName: "", schoolEmail: "", schoolPhone: "", englishProficiency: "FLUENT", learningStrengths: "Mathematics and reading", supportHistory: "", permissionToContactSchool: true },
      medical: { doctorName: "", doctorPhone: "", bloodGroup: "", medicalConditions: "None", allergies: "None", regularMedication: "None", dietaryRequirements: "None", disabilitiesOrSend: false, sendDetails: "", immunisationsUpToDate: "YES", mentalHealthOrWelfareNeeds: "", emergencyTreatmentConsent: true },
      emergency: { contacts: [{ fullName: "David Cole", relationship: "Uncle", primaryPhone: "+2348000000001", alternatePhone: "", email: "", authorisedToCollect: true }], collectionNotes: "" },
      documents: { additionalInformation: "" },
      declaration: { informationAccurate: true, parentalResponsibilityConfirmed: true, privacyNoticeAccepted: true, admissionsTermsAccepted: true, marketingConsent: false, signatoryName: "Grace Cole", signatoryRelationship: "Mother", signedOn: "2026-09-23" },
    } as const;

    for (const [section, body] of Object.entries(sections)) {
      await request(app).patch(`/api/v1/admissions/applications/${id}/sections/${section}`).set(headers).send(body).expect(200);
    }

    for (const category of ["passport-photo", "identity-document", "school-report"]) {
      await request(app).post(`/api/v1/admissions/applications/${id}/documents`).set(headers).field("category", category).attach("file", Buffer.from("synthetic-test-document"), { filename: `${category}.pdf`, contentType: "application/pdf" }).expect(201);
    }

    const submitted = await request(app).post(`/api/v1/admissions/applications/${id}/submit`).set(headers).expect(200);
    expect(submitted.body.data.status).toBe("SUBMITTED");
    expect(submitted.body.data.documents).toHaveLength(3);
    expect(submitted.body.data.formData.entry).not.toHaveProperty("scholarshipInterest");
    expect(submitted.body.data.formData.entry).not.toHaveProperty("scholarshipNotes");
    expect(submitted.body.data.formData.academic.curriculum).toBe("NIGERIAN_BRITISH_BLEND");
    expect(submitted.body.data.formData.academic.reasonForLeaving).toBe("ACADEMIC_PROGRESSION");

    const tracked = await request(app).post("/api/v1/admissions/track").send({ applicationNumber }).expect(200);
    expect(tracked.body.data.status).toBe("SUBMITTED");
    expect(tracked.body.data.firstName).toBe("Amina");

    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@abc.test", password: "ChangeMe123!" }).expect(200);
    const authorization = { Authorization: `Bearer ${login.body.data.accessToken as string}` };

    const listed = await request(app).get(`/api/v1/admissions/admin/applications?search=${applicationNumber}`).set(authorization).expect(200);
    expect(listed.body.data.items).toHaveLength(1);
    expect(listed.body.data.items[0].id).toBe(id);

    const edited = await request(app)
      .patch(`/api/v1/admissions/admin/applications/${id}`)
      .set(authorization)
      .send({ firstName: "Amina", lastName: "Cole-Smith", dateOfBirth: personal.dateOfBirth, email: uniqueEmail, phone: "+2348000000009", entryYearGroup: "YEAR_9" })
      .expect(200);
    expect(edited.body.data.lastName).toBe("Cole-Smith");
    expect(edited.body.data.entryYearGroup).toBe("YEAR_9");

    for (const targetStatus of ["UNDER_REVIEW", "OFFERED", "ACCEPTED"] as const) {
      const transitioned = await request(app)
        .post(`/api/v1/admissions/admin/applications/${id}/transition`)
        .set(authorization)
        .send({ targetStatus, note: `Test transition to ${targetStatus}` })
        .expect(200);
      expect(transitioned.body.data.status).toBe(targetStatus);
    }

    const enrolled = await request(app).post(`/api/v1/admissions/admin/applications/${id}/enrol`).set(authorization).send({}).expect(200);
    expect(enrolled.body.data.status).toBe("ENROLLED");
    expect(enrolled.body.data.student.admissionNumber).toMatch(/^ABC-26/);
    studentIds.push(enrolled.body.data.student.id as string);

    const links = await prisma.studentGuardian.findMany({ where: { studentId: enrolled.body.data.student.id }, select: { guardianId: true } });
    guardianIds.push(...links.map((link) => link.guardianId));
    expect(links).toHaveLength(1);
    expect(await prisma.enrollment.count({ where: { studentId: enrolled.body.data.student.id } })).toBe(1);
  });
});
