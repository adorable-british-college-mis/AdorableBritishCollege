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
  ["timetable.read", "View timetable and cover arrangements"],
  ["timetable.manage", "Create lessons and manage cover arrangements"],
  ["attendance.read", "View attendance registers and analytics"],
  ["attendance.manage", "Take, amend and submit attendance registers"],
  ["behaviour.read", "View behaviour events, rewards, sanctions and reports"],
  ["behaviour.manage", "Manage behaviour events, rewards, sanctions and categories"],
  ["reports.read", "View and download generated reports"],
  ["reports.manage", "Generate and archive reports"],
  ["communication.read", "View school communications"],
  ["communication.manage", "Create and manage school communications"],
  ["users.manage", "Manage users, roles, and permissions"],
  ["audit.read", "View audit events"],
  ["admissions.read", "View submitted admissions applications"],
  ["admissions.manage", "Review applications and record admissions decisions"],
  ["admissions.enrol", "Convert accepted applications into learner records"],
  ["safeguarding.read", "View safeguarding records"],
] as const;

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  SCHOOL_ADMIN: ["students.read", "students.read.all", "students.create", "students.update", "students.archive", "academics.read", "academics.manage", "timetable.read", "timetable.manage", "attendance.read", "attendance.manage", "behaviour.read", "behaviour.manage", "reports.read", "reports.manage", "communication.read", "communication.manage", "admissions.read", "admissions.manage", "admissions.enrol", "users.manage", "audit.read"],
  TEACHER: ["students.read", "students.read.assigned", "academics.read", "timetable.read", "attendance.read", "attendance.manage", "behaviour.read", "behaviour.manage", "reports.read", "communication.read", "communication.manage"],
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
  const departmentNames = [...new Set([...subjects.map(([, , department]) => department), "Humanities", "Creative Arts", "Physical Education"] )];
  const departments = new Map<string, { id: string }>();
  for (const name of departmentNames) {
    const code = name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase();
    const department = await prisma.department.upsert({ where: { name }, update: { isActive: true, archivedAt: null }, create: { code, name } });
    departments.set(name, department);
  }
  for (const [code, name, department] of subjects) {
    await prisma.subject.upsert({ where: { code }, update: { departmentId: departments.get(department)!.id, department, isActive: true, archivedAt: null }, create: { code, name, department, departmentId: departments.get(department)!.id } });
  }

  const teacherFixtures = [
    ["STF-0001", "Mariam", "Adeyemi", "Mathematics"],
    ["STF-0002", "Sarah", "Johnson", "English"],
    ["STF-0003", "David", "Okafor", "Science"],
    ["STF-0004", "Helen", "Williams", "Humanities"],
    ["STF-0005", "Ruth", "Clarke", "Creative Arts"],
    ["STF-0006", "Michael", "Brown", "Physical Education"],
  ] as const;
  const teachers: Array<{ id: string }> = [];
  for (const [staffNumber, firstName, lastName, department] of teacherFixtures) {
    teachers.push(await prisma.staff.upsert({ where: { staffNumber }, update: { firstName, lastName, department, departmentId: departments.get(department)!.id, status: "ACTIVE", archivedAt: null }, create: { staffNumber, firstName, lastName, department, departmentId: departments.get(department)!.id, jobTitle: "Teacher" } }));
  }
  const autumn = await prisma.term.findFirstOrThrow({ where: { academicYearId: academicYear.id, name: "Autumn" } });
  const activeSubjects = await prisma.subject.findMany({ where: { code: { in: subjects.map(([code]) => code) } }, orderBy: { code: "asc" } });
  const activeForms = await prisma.formGroup.findMany({ where: { isActive: true }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { code: "asc" }] });
  for (const yearGroup of yearGroups) {
    const curriculum = await prisma.curriculum.upsert({ where: { academicYearId_code: { academicYearId: academicYear.id, code: `${yearGroup.code}-CORE` } }, update: { isActive: true, archivedAt: null }, create: { academicYearId: academicYear.id, yearGroupId: yearGroup.id, code: `${yearGroup.code}-CORE`, name: `${yearGroup.name} Core Curriculum` } });
    for (const subject of activeSubjects) {
      await prisma.curriculumSubject.upsert({ where: { academicYearId_yearGroupId_subjectId: { academicYearId: academicYear.id, yearGroupId: yearGroup.id, subjectId: subject.id } }, update: { curriculumId: curriculum.id, isActive: true, archivedAt: null }, create: { academicYearId: academicYear.id, yearGroupId: yearGroup.id, subjectId: subject.id, curriculumId: curriculum.id, weeklyPeriods: 4 } });
    }
    await prisma.formGroup.updateMany({ where: { yearGroupId: yearGroup.id, isActive: true }, data: { curriculumId: curriculum.id } });
  }
  for (let index = 0; index < activeForms.length; index += 1) {
    const group = activeForms[index]!;
    const subject = activeSubjects[index % activeSubjects.length]!;
    const teacher = teachers[index % teachers.length]!;
    await prisma.teachingAssignment.upsert({ where: { academicYearId_formGroupId_subjectId: { academicYearId: academicYear.id, formGroupId: group.id, subjectId: subject.id } }, update: { staffId: teacher.id, departmentId: subject.departmentId, isActive: true, archivedAt: null }, create: { academicYearId: academicYear.id, formGroupId: group.id, subjectId: subject.id, staffId: teacher.id, departmentId: subject.departmentId } });
  }
  const periods = [
    ["Period 1", "08:30", "09:30"], ["Period 2", "09:30", "10:30"], ["Period 3", "11:00", "12:00"],
    ["Period 4", "12:00", "13:00"], ["Period 5", "13:45", "14:45"], ["Period 6", "14:45", "15:45"],
  ] as const;
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    for (const [periodIndex, [periodLabel, startsAt, endsAt]] of periods.entries()) {
      const formGroup = activeForms[(weekday * 3 + periodIndex) % activeForms.length]!;
      const subject = activeSubjects[(weekday + periodIndex) % activeSubjects.length]!;
      const teacher = teachers[(weekday + periodIndex) % teachers.length]!;
      const exists = await prisma.timetableSlot.findFirst({ where: { termId: autumn.id, formGroupId: formGroup.id, weekday, startsAt } });
      if (!exists) await prisma.timetableSlot.create({ data: { termId: autumn.id, yearGroupId: formGroup.yearGroupId, formGroupId: formGroup.id, subjectId: subject.id, staffId: teacher.id, weekday, startsAt, endsAt, periodLabel, room: periodIndex % 3 === 0 ? "Room 14" : periodIndex % 3 === 1 ? "Room 8" : "Lab 2" } });
    }
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

  const categoryFixtures = [
    ["OUTSTANDING_WORK", "Outstanding Work", "POSITIVE", 5],
    ["EXCELLENT_PARTICIPATION", "Excellent Participation", "POSITIVE", 3],
    ["COMMUNITY_SERVICE", "Community Service Award", "POSITIVE", 10],
    ["DISRUPTIVE_BEHAVIOUR", "Disruptive Behaviour", "INCIDENT", -3],
    ["HOMEWORK_NOT_DONE", "Homework Not Done", "INCIDENT", -2],
    ["UNIFORM_VIOLATION", "Uniform Violation", "INCIDENT", -1],
    ["REPEATED_LATENESS", "Repeated Lateness", "INCIDENT", -2],
    ["BULLYING_INCIDENT", "Bullying Incident", "INCIDENT", -10],
  ] as const;
  const behaviourCategories = new Map<string, { id: string; type: "POSITIVE" | "INCIDENT"; defaultPoints: number; name: string }>();
  for (const [code, name, type, defaultPoints] of categoryFixtures) {
    behaviourCategories.set(code, await prisma.behaviourCategory.upsert({ where: { code }, update: { name, type, defaultPoints, isActive: true, archivedAt: null }, create: { code, name, type, defaultPoints } }));
  }
  const seededStudents = await prisma.student.findMany({ where: { admissionNumber: { in: syntheticStudents.map((item) => item.admissionNumber) } }, include: { enrollments: { where: { academicYearId: academicYear.id } } }, orderBy: { admissionNumber: "asc" } });
  if (await prisma.behaviourEvent.count({ where: { termId: autumn.id } }) === 0) {
    const eventFixtures = [
      ["OUTSTANDING_WORK", "Outstanding work in class", "RESOLVED"],
      ["DISRUPTIVE_BEHAVIOUR", "Disruptive behaviour during lesson", "OPEN"],
      ["EXCELLENT_PARTICIPATION", "Excellent class participation", "RESOLVED"],
      ["REPEATED_LATENESS", "Repeated lateness to morning registration", "ESCALATED"],
    ] as const;
    for (const [index, student] of seededStudents.entries()) {
      const [code, summary, status] = eventFixtures[index % eventFixtures.length]!;
      const category = behaviourCategories.get(code)!;
      await prisma.behaviourEvent.create({ data: { studentId: student.id, termId: autumn.id, formGroupId: student.enrollments[0]?.formGroupId, staffId: teachers[index % teachers.length]!.id, categoryId: category.id, type: category.type, status, summary, points: category.defaultPoints, occurredAt: new Date(`2026-09-${String(21 + index).padStart(2, "0")}T09:${String(index * 10).padStart(2, "0")}:00Z`), resolvedAt: status === "RESOLVED" ? new Date() : null } });
    }
  }
  if (seededStudents.length && await prisma.behaviourReward.count({ where: { termId: autumn.id } }) === 0) {
    await prisma.behaviourReward.create({ data: { studentId: seededStudents[0]!.id, termId: autumn.id, staffId: teachers[0]!.id, title: "Headteacher Commendation", description: "Recognised for consistent effort and leadership.", points: 10, awardedAt: new Date("2026-09-23T11:00:00Z") } });
  }
  if (seededStudents.length > 1 && await prisma.behaviourSanction.count({ where: { termId: autumn.id } }) === 0) {
    const incident = await prisma.behaviourEvent.findFirst({ where: { studentId: seededStudents[1]!.id, termId: autumn.id, type: "INCIDENT" } });
    await prisma.behaviourSanction.create({ data: { studentId: seededStudents[1]!.id, termId: autumn.id, staffId: teachers[1]!.id, behaviourEventId: incident?.id, type: "DETENTION", status: "ACTIVE", title: "After-school detention", description: "Reflective session following the recorded incident.", scheduledFor: new Date("2026-09-24T15:45:00Z") } });
  }

  console.log("Seed complete. Development login: admin@abc.test / ChangeMe123!");
}

main().finally(async () => prisma.$disconnect());
