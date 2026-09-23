import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissions = [
  ["students.read", "View student records within assigned scope"],
  ["students.read.all", "View all student records"],
  ["students.read.assigned", "View assigned student records"],
  ["students.create", "Create student records"],
  ["students.update", "Update student records"],
  ["students.archive", "Archive student records"],
  ["academics.read", "View academic reference data"],
  ["academics.manage", "Manage academic reference data"],
  ["users.manage", "Manage users, roles, and permissions"],
  ["audit.read", "View audit events"],
  ["admissions.read", "View submitted admissions applications"],
  ["admissions.manage", "Review applications and record admissions decisions"],
  ["admissions.enrol", "Convert accepted applications into learner records"],
  ["safeguarding.read", "View safeguarding records"],
] as const;

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  SCHOOL_ADMIN: ["students.read", "students.read.all", "students.create", "students.update", "students.archive", "academics.read", "academics.manage", "admissions.read", "admissions.manage", "admissions.enrol", "users.manage", "audit.read"],
  TEACHER: ["students.read", "students.read.assigned", "academics.read"],
  PARENT: ["students.read", "academics.read"],
  STUDENT: ["students.read", "academics.read"],
};

async function main() {
  const permissionRows = new Map<string, { id: string }>();
  for (const [code, description] of permissions) {
    permissionRows.set(code, await prisma.permission.upsert({ where: { code }, update: { description }, create: { code, description }, select: { id: true } }));
  }

  const roleRows = new Map<string, { id: string }>();
  for (const [code, codes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: code.split("_").map((word) => word[0] + word.slice(1).toLowerCase()).join(" ") },
      create: { code, name: code.split("_").map((word) => word[0] + word.slice(1).toLowerCase()).join(" "), isSystem: true },
      select: { id: true },
    });
    roleRows.set(code, role);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: codes.map((permissionCode) => ({ roleId: role.id, permissionId: permissionRows.get(permissionCode)!.id })) });
  }

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@abc.test" },
    update: {},
    create: { email: "admin@abc.test", passwordHash, firstName: "System", lastName: "Administrator" },
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: roleRows.get("SUPER_ADMIN")!.id } }, update: {}, create: { userId: admin.id, roleId: roleRows.get("SUPER_ADMIN")!.id } });

  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2026/2027" },
    update: { isCurrent: true },
    create: { name: "2026/2027", startsOn: new Date("2026-09-01"), endsOn: new Date("2027-07-16"), isCurrent: true },
  });
  const termCount = await prisma.term.count({ where: { academicYearId: academicYear.id } });
  if (!termCount) {
    await prisma.term.createMany({ data: [
      { academicYearId: academicYear.id, name: "Autumn", startsOn: new Date("2026-09-01"), endsOn: new Date("2026-12-18") },
      { academicYearId: academicYear.id, name: "Spring", startsOn: new Date("2027-01-05"), endsOn: new Date("2027-04-02") },
      { academicYearId: academicYear.id, name: "Summer", startsOn: new Date("2027-04-19"), endsOn: new Date("2027-07-16") },
    ] });
  }

  const yearGroups = await Promise.all([7, 8, 9, 10, 11, 12, 13].map((year, index) => prisma.yearGroup.upsert({
    where: { code: `Y${year}` }, update: {}, create: { code: `Y${year}`, name: `Year ${year}`, displayOrder: index + 1 },
  })));
  for (const [yearIndex, yearGroup] of yearGroups.entries()) {
    for (const suffix of ["A", "B", "C"]) {
      const code = `${yearIndex + 7}${suffix}`;
      await prisma.formGroup.upsert({ where: { code }, update: { name: code, yearGroupId: yearGroup.id, isActive: true }, create: { code, name: code, yearGroupId: yearGroup.id } });
    }
  }
  for (const [code, name] of [["WIN", "Windsor"], ["LAN", "Lancaster"], ["TUD", "Tudor"]] as const) {
    await prisma.house.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } });
  }
  const subjects: ReadonlyArray<readonly [string, string, string]> = [
    ["ENG", "English Language", "English"],
    ["MAT", "Mathematics", "Mathematics"],
    ["BIO", "Biology", "Science"],
    ["ICT", "Computer Science", "Technology"],
  ];
  for (const [code, name, department] of subjects) {
    await prisma.subject.upsert({ where: { code }, update: {}, create: { code, name, department } });
  }

  const syntheticStudents = [
    { admissionNumber: "ABC-26001", firstName: "Amara", lastName: "Okafor", dateOfBirth: "2012-04-12", gender: "FEMALE" as const, yearIndex: 1 },
    { admissionNumber: "ABC-26002", firstName: "Daniel", lastName: "Mensah", dateOfBirth: "2011-08-21", gender: "MALE" as const, yearIndex: 2 },
    { admissionNumber: "ABC-26003", firstName: "Zainab", lastName: "Bello", dateOfBirth: "2010-11-03", gender: "FEMALE" as const, yearIndex: 3 },
    { admissionNumber: "ABC-26004", firstName: "Tobi", lastName: "Adeyemi", dateOfBirth: "2009-02-16", gender: "MALE" as const, yearIndex: 4 },
  ];
  for (const sample of syntheticStudents) {
    const student = await prisma.student.upsert({
      where: { admissionNumber: sample.admissionNumber }, update: {},
      create: { admissionNumber: sample.admissionNumber, firstName: sample.firstName, lastName: sample.lastName, dateOfBirth: new Date(sample.dateOfBirth), gender: sample.gender, nationality: "Nigerian" },
    });
    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } }, update: {},
      create: { studentId: student.id, academicYearId: academicYear.id, yearGroupId: yearGroups[sample.yearIndex]!.id, startsOn: academicYear.startsOn },
    });
  }

  console.log("Seed complete. Development login: admin@abc.test / ChangeMe123!");
}

main().finally(async () => prisma.$disconnect());
