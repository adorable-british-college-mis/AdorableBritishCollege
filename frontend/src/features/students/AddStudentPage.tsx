import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Home } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createStudent,
  getAcademicReference,
  getStudent,
  updateStudent,
} from "../../lib/api";
import type { CreateStudentInput } from "../../types";

type StudentForm = Omit<CreateStudentInput, "guardian"> & {
  guardianName: string;
  guardianRelationship: string;
  guardianEmail: string;
  guardianPhone: string;
};

const today = new Date().toISOString().slice(0, 10);
const emptyForm = (): StudentForm => ({
  admissionNumber: "",
  title: "",
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  gender: "NOT_STATED",
  nationality: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  townCity: "",
  postcode: "",
  yearGroupId: "",
  academicYearId: "",
  formGroupId: "",
  houseId: "",
  enrolmentDate: today,
  status: "ACTIVE",
  guardianName: "",
  guardianRelationship: "",
  guardianEmail: "",
  guardianPhone: "",
});

export function AddStudentPage() {
  const { studentId } = useParams();
  const isEditing = Boolean(studentId);
  const navigate = useNavigate();
  const client = useQueryClient();
  const reference = useQuery({
    queryKey: ["academic-reference"],
    queryFn: getAcademicReference,
  });
  const student = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => getStudent(studentId!),
    enabled: isEditing,
  });
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const hydrated = useRef(false);
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const forms = useMemo(
    () =>
      reference.data?.formGroups.filter(
        (item) => item.yearGroupId === form.yearGroupId,
      ) ?? [],
    [form.yearGroupId, reference.data],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    if (!student.data || hydrated.current) return;
    const record = student.data;
    const enrollment = record.enrollments[0];
    const primary =
      record.guardians?.find((item) => item.isPrimaryContact) ??
      record.guardians?.[0];
    setForm({
      admissionNumber: record.admissionNumber,
      title: record.title ?? "",
      firstName: record.firstName,
      middleName: record.middleName ?? "",
      lastName: record.lastName,
      preferredName: record.preferredName ?? "",
      dateOfBirth: record.dateOfBirth.slice(0, 10),
      gender: record.gender,
      nationality: record.nationality ?? "",
      email: record.email ?? "",
      phone: record.phone ?? "",
      addressLine1: record.addressLine1 ?? "",
      addressLine2: record.addressLine2 ?? "",
      townCity: record.townCity ?? "",
      postcode: record.postcode ?? "",
      yearGroupId: enrollment?.yearGroup.id ?? "",
      academicYearId: enrollment?.academicYear.id ?? "",
      formGroupId: enrollment?.formGroup?.id ?? "",
      houseId: enrollment?.house?.id ?? "",
      enrolmentDate: enrollment?.startsOn.slice(0, 10) ?? today,
      status: record.status === "APPLICANT" ? "APPLICANT" : "ACTIVE",
      guardianName: primary
        ? `${primary.guardian.firstName} ${primary.guardian.lastName}`
        : "",
      guardianRelationship: primary?.relationship ?? "",
      guardianEmail: primary?.guardian.email ?? "",
      guardianPhone: primary?.guardian.phone ?? "",
    });
    hydrated.current = true;
  }, [student.data]);

  const saveRecord = useMutation({
    mutationFn: (input: CreateStudentInput) =>
      isEditing ? updateStudent(studentId!, input) : createStudent(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["students"] }),
        client.invalidateQueries({ queryKey: ["student-stats"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      navigate("/students", { replace: true });
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError
          ? error.message
          : `The student record could not be ${isEditing ? "updated" : "created"}.`,
      );
      window.setTimeout(
        () =>
          errorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
    },
  });

  function update<K extends keyof StudentForm>(key: K, value: StudentForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "yearGroupId" ? { formGroupId: "" } : {}),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const required: Array<[string, string]> = [
      [form.firstName, "First name"],
      [form.lastName, "Last name"],
      [form.dateOfBirth, "Date of birth"],
      [form.nationality ?? "", "Nationality"],
      [form.yearGroupId, "Year group"],
      [form.enrolmentDate, "Enrolment date"],
      [form.guardianName, "Parent or guardian name"],
      [form.guardianRelationship, "Relationship"],
    ];
    const missing = required
      .filter(([value]) => !value.trim())
      .map(([, label]) => label);
    if (form.gender === "NOT_STATED") missing.push("Gender");
    if (missing.length) {
      setMessage(
        `Complete the following required fields: ${missing.join(", ")}.`,
      );
      window.setTimeout(
        () =>
          errorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
      return;
    }
    const {
      guardianName,
      guardianRelationship,
      guardianEmail,
      guardianPhone,
      ...student
    } = form;
    const nameParts = guardianName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setMessage("Enter the parent or guardian's full name.");
      return;
    }
    const currentYear =
      reference.data?.academicYears.find((item) => item.isCurrent) ??
      reference.data?.academicYears[0];
    if (!currentYear) {
      setMessage("Configure an academic year before enrolling a student.");
      return;
    }
    saveRecord.mutate({
      ...student,
      academicYearId: currentYear.id,
      guardian: {
        firstName: nameParts.shift()!,
        lastName: nameParts.join(" "),
        relationship: guardianRelationship,
        email: guardianEmail,
        phone: guardianPhone,
      },
    });
  }

  return (
    <div className="admin-page-container student-create-page">
      <div className="student-create-topline">
        <div className="breadcrumb-nav">
          <Home size={14} />
          <span>/</span>
          <Link to="/students">Students</Link>
          <span>/</span>
          <strong>{isEditing ? "Edit Student" : "Add New Student"}</strong>
        </div>
        <Link className="back-to-list" to="/students">
          <ArrowLeft size={15} /> Back to Students List
        </Link>
      </div>
      <div className="admin-page-title-group student-create-heading">
        <h1>{isEditing ? "Edit Student" : "Add New Student"}</h1>
        <p>
          {isEditing
            ? "Update the learner's personal, enrolment, contact and guardian records."
            : "Fill in the academic records, personal information, and guardian details to register a new pupil."}
        </p>
      </div>
      <form onSubmit={submit} className="student-create-form" noValidate>
        <section className="student-form-section">
          <h2>1. Personal Information</h2>
          <div className="student-form-grid">
            <label>
              Title
              <select
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
              >
                <option value="">Select Title</option>
                <option>Master</option>
                <option>Miss</option>
                <option>Mr</option>
                <option>Ms</option>
              </select>
            </label>
            <label>
              First Name *
              <input
                required
                value={form.firstName}
                onChange={(event) => update("firstName", event.target.value)}
                placeholder="e.g. John"
              />
            </label>
            <label>
              Middle Name
              <input
                value={form.middleName}
                onChange={(event) => update("middleName", event.target.value)}
                placeholder="e.g. Robert"
              />
            </label>
            <label>
              Last Name *
              <input
                required
                value={form.lastName}
                onChange={(event) => update("lastName", event.target.value)}
                placeholder="e.g. Smith"
              />
            </label>
            <label>
              Preferred Name (Optional)
              <input
                value={form.preferredName}
                onChange={(event) =>
                  update("preferredName", event.target.value)
                }
                placeholder="e.g. Johnny"
              />
            </label>
            <label>
              Date of Birth *
              <input
                type="date"
                required
                max={today}
                value={form.dateOfBirth}
                onChange={(event) => update("dateOfBirth", event.target.value)}
              />
            </label>
            <label>
              Gender *
              <select
                required
                value={form.gender}
                onChange={(event) =>
                  update("gender", event.target.value as StudentForm["gender"])
                }
              >
                <option value="NOT_STATED">Select Gender</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Nationality *
              <input
                required
                value={form.nationality}
                onChange={(event) => update("nationality", event.target.value)}
                placeholder="e.g. Nigerian"
              />
            </label>
          </div>
        </section>

        <section className="student-form-section">
          <h2>2. Enrolment Details</h2>
          <div className="student-form-grid">
            <label>
              Admission Number
              <input
                value={form.admissionNumber}
                onChange={(event) =>
                  update("admissionNumber", event.target.value.toUpperCase())
                }
                placeholder="Generated automatically if left blank"
              />
            </label>
            <label>
              Enrolment Date *
              <input
                type="date"
                required
                value={form.enrolmentDate}
                onChange={(event) =>
                  update("enrolmentDate", event.target.value)
                }
              />
            </label>
            <label>
              Year Group *
              <select
                required
                value={form.yearGroupId}
                onChange={(event) => update("yearGroupId", event.target.value)}
              >
                <option value="">Select Year Group</option>
                {reference.data?.yearGroups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Form / Class
              <select
                value={form.formGroupId}
                disabled={!form.yearGroupId}
                onChange={(event) => update("formGroupId", event.target.value)}
              >
                <option value="">Select Form/Class</option>
                {forms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              House
              <select
                value={form.houseId}
                onChange={(event) => update("houseId", event.target.value)}
              >
                <option value="">Select House</option>
                {reference.data?.houses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status *
              <select
                required
                value={form.status}
                onChange={(event) =>
                  update("status", event.target.value as StudentForm["status"])
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="APPLICANT">Applicant</option>
              </select>
            </label>
          </div>
        </section>

        <section className="student-form-section">
          <h2>3. Contact Information</h2>
          <div className="student-form-grid">
            <label>
              Email Address
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="student.name@school.com"
              />
            </label>
            <label>
              Phone Number
              <input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="e.g. +234 801 234 5678"
              />
            </label>
            <label>
              Home Address Line 1
              <input
                value={form.addressLine1}
                onChange={(event) => update("addressLine1", event.target.value)}
                placeholder="e.g. 12 High Street"
              />
            </label>
            <label>
              Address Line 2 (Optional)
              <input
                value={form.addressLine2}
                onChange={(event) => update("addressLine2", event.target.value)}
                placeholder="e.g. Apartment, Suite, Unit"
              />
            </label>
            <label>
              City / Town
              <input
                value={form.townCity}
                onChange={(event) => update("townCity", event.target.value)}
                placeholder="e.g. Abuja"
              />
            </label>
            <label>
              Postcode
              <input
                value={form.postcode}
                onChange={(event) => update("postcode", event.target.value)}
                placeholder="e.g. 900001"
              />
            </label>
          </div>
        </section>

        <section className="student-form-section">
          <h2>4. Parent &amp; Guardian Details</h2>
          <div className="student-form-grid">
            <label>
              Parent / Guardian Name *
              <input
                required
                value={form.guardianName}
                onChange={(event) => update("guardianName", event.target.value)}
                placeholder="e.g. Sarah Smith"
              />
            </label>
            <label>
              Relationship *
              <select
                required
                value={form.guardianRelationship}
                onChange={(event) =>
                  update("guardianRelationship", event.target.value)
                }
              >
                <option value="">Select Relationship</option>
                <option>Mother</option>
                <option>Father</option>
                <option>Step-parent</option>
                <option>Guardian</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Contact Email Address
              <input
                type="email"
                value={form.guardianEmail}
                onChange={(event) =>
                  update("guardianEmail", event.target.value)
                }
                placeholder="parent@example.com"
              />
            </label>
            <label>
              Contact Phone Number
              <input
                value={form.guardianPhone}
                onChange={(event) =>
                  update("guardianPhone", event.target.value)
                }
                placeholder="e.g. +234 798 765 4321"
              />
            </label>
          </div>
        </section>

        {message && (
          <div
            className="form-error student-save-error"
            role="alert"
            ref={errorRef}
          >
            <strong>Student not saved.</strong> {message}
          </div>
        )}
        <footer className="student-form-actions">
          <span>
            <i /> All basic fields are validated dynamically.
          </span>
          <div>
            <Link className="secondary-button" to="/students">
              Cancel
            </Link>
            <button
              className="primary-button"
              disabled={saveRecord.isPending || student.isLoading}
            >
              <Check size={17} />
              {saveRecord.isPending
                ? "Saving..."
                : isEditing
                  ? "Save Student Changes"
                  : "Save & Enrol Student"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
