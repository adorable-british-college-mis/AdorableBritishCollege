import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, Camera, Check, CheckCircle2, ClipboardCheck, FileCheck2,
  FileText, HeartPulse, HelpCircle, LockKeyhole, Phone, ShieldCheck, Upload, UserRound, UsersRound, X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ApiError, getAdmissionApplication, saveAdmissionSection, startAdmissionApplication,
  submitAdmissionApplication, trackAdmissionApplication, uploadAdmissionDocument,
} from "../../lib/api";
import {
  initialAdmissionData, normalizeAdmissionData, reasonForLeavingOptions, type AdmissionApplication,
  type AdmissionDocument, type AdmissionFormData, type AdmissionSection, type EmergencyContact, type Guardian,
} from "./admissions-types";
import "./admissions.css";

const steps: Array<{ key: AdmissionSection; label: string; title: string; description: string; icon: typeof UserRound }> = [
  { key: "personal", label: "Personal Details", title: "Personal Details", description: "Tell us about the pupil applying.", icon: UserRound },
  { key: "entry", label: "Year Group & Entry", title: "Year Group & Entry", description: "Choose the intended entry point and pupil arrangement.", icon: CalendarDays },
  { key: "guardians", label: "Parent / Guardian", title: "Parent and Guardian Details", description: "Provide the adults with parental responsibility for this application.", icon: UsersRound },
  { key: "academic", label: "Academic Background", title: "Academic Background", description: "Tell us about the pupil's current education and learning profile.", icon: BookOpen },
  { key: "medical", label: "Medical & Welfare", title: "Medical and Welfare", description: "Share information needed to support the pupil safely at school.", icon: HeartPulse },
  { key: "emergency", label: "Emergency Contacts", title: "Emergency Contacts", description: "Add someone we may contact if parents or guardians are unavailable.", icon: Phone },
  { key: "documents", label: "Supporting Documents", title: "Supporting Documents", description: "Upload clear copies of the documents required for assessment.", icon: FileText },
  { key: "declaration", label: "Declaration & Submit", title: "Declaration and Submit", description: "Review the application and provide the required declarations.", icon: ClipboardCheck },
];

const documentRequirements = [
  { category: "passport-photo", label: "Recent passport photograph", required: true, hint: "JPG or PNG, maximum 5 MB" },
  { category: "identity-document", label: "Birth certificate or passport", required: true, hint: "PDF, JPG or PNG, maximum 5 MB" },
  { category: "school-report", label: "Most recent school report", required: true, hint: "PDF, JPG or PNG, maximum 5 MB" },
  { category: "immunisation-record", label: "Immunisation record", required: false, hint: "Where available" },
  { category: "transfer-letter", label: "Transfer or leaving letter", required: false, hint: "Where applicable" },
  { category: "medical-evidence", label: "Medical evidence", required: false, hint: "Where relevant" },
  { category: "send-evidence", label: "SEND or learning support evidence", required: false, hint: "Where relevant" },
] as const;

const inputDate = (date = new Date()) => date.toISOString().slice(0, 10);
const draftStorageKey = "abc-admissions-draft";

function Field({ label, required, hint, children, wide }: { label: string; required?: boolean; hint?: string; children: ReactNode; wide?: boolean }) {
  return <div className={`admission-field ${wide ? "wide" : ""}`}><label>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && <small>{hint}</small>}</div>;
}

function Choice({ label, checked, onChange, type = "checkbox", required }: { label: string; checked: boolean; onChange: (checked: boolean) => void; type?: "checkbox" | "radio"; required?: boolean }) {
  return <label className="choice"><input type={type} checked={checked} required={required} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function SectionHeading({ step }: { step: typeof steps[number] }) {
  const Icon = step.icon;
  return <div className="admission-section-heading"><span><Icon size={22} /></span><div><h2>{step.title}</h2><p>{step.description}</p></div></div>;
}

function Select({ value, onChange, required, children }: { value: string; onChange: (value: string) => void; required?: boolean; children: ReactNode }) {
  return <select value={value} required={required} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

function GuardianFields({ value, onChange, prefix }: { value: Guardian; onChange: (next: Guardian) => void; prefix: string }) {
  const set = <K extends keyof Guardian>(key: K, next: Guardian[K]) => onChange({ ...value, [key]: next });
  const setAddress = (key: keyof Guardian["address"], next: string) => onChange({ ...value, address: { ...value.address, [key]: next } });
  return <div className="form-grid guardian-grid">
    <Field label="Title" required><Select value={value.title} required onChange={(next) => set("title", next as Guardian["title"])}><option value="MR">Mr</option><option value="MRS">Mrs</option><option value="MS">Ms</option><option value="DR">Dr</option><option value="PROF">Prof</option><option value="OTHER">Other</option></Select></Field>
    <Field label="Relationship to pupil" required><Select value={value.relationship} required onChange={(next) => set("relationship", next as Guardian["relationship"])}><option value="MOTHER">Mother</option><option value="FATHER">Father</option><option value="STEP_PARENT">Step-parent</option><option value="LEGAL_GUARDIAN">Legal guardian</option><option value="OTHER">Other</option></Select></Field>
    <Field label="First name" required><input name={`${prefix}-first-name`} value={value.firstName} required onChange={(event) => set("firstName", event.target.value)} /></Field>
    <Field label="Last name" required><input name={`${prefix}-last-name`} value={value.lastName} required onChange={(event) => set("lastName", event.target.value)} /></Field>
    <Field label="Email address" required><input type="email" value={value.email} required onChange={(event) => set("email", event.target.value)} /></Field>
    <Field label="Mobile number" required><input type="tel" value={value.phone} required onChange={(event) => set("phone", event.target.value)} /></Field>
    <Field label="Alternative number"><input type="tel" value={value.alternatePhone} onChange={(event) => set("alternatePhone", event.target.value)} /></Field>
    <Field label="Occupation"><input value={value.occupation} onChange={(event) => set("occupation", event.target.value)} /></Field>
    <Field label="Address line 1" required><input value={value.address.line1} required onChange={(event) => setAddress("line1", event.target.value)} /></Field>
    <Field label="Address line 2"><input value={value.address.line2} onChange={(event) => setAddress("line2", event.target.value)} /></Field>
    <Field label="Town or city" required><input value={value.address.city} required onChange={(event) => setAddress("city", event.target.value)} /></Field>
    <Field label="State / county"><input value={value.address.countyState} onChange={(event) => setAddress("countyState", event.target.value)} /></Field>
    <Field label="Postcode"><input value={value.address.postcode} onChange={(event) => setAddress("postcode", event.target.value)} /></Field>
    <Field label="Country" required><input value={value.address.country} required onChange={(event) => setAddress("country", event.target.value)} /></Field>
    <Field label="Preferred contact method" required><Select value={value.preferredContactMethod} required onChange={(next) => set("preferredContactMethod", next as Guardian["preferredContactMethod"])}><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="PHONE">Telephone</option></Select></Field>
    <div className="admission-field choice-stack"><Choice label="Has parental responsibility" checked={value.parentalResponsibility} onChange={(next) => set("parentalResponsibility", next)} /><Choice label="Lives with the pupil" checked={value.livesWithApplicant} onChange={(next) => set("livesWithApplicant", next)} /></div>
  </div>;
}

function TrackModal({ onClose }: { onClose: () => void }) {
  const [applicationNumber, setApplicationNumber] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof trackAdmissionApplication>> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { setResult(await trackAdmissionApplication({ applicationNumber })); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "We could not find the application."); }
    finally { setLoading(false); }
  }
  return <div className="admission-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="admission-modal" role="dialog" aria-modal="true" aria-labelledby="track-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>{result ? <div className="track-result"><span className="success-mark"><CheckCircle2 size={32} /></span><p className="admission-kicker">Application found</p><h2 id="track-title">{result.firstName} {result.lastName}</h2><dl><div><dt>Application number</dt><dd>{result.applicationNumber}</dd></div><div><dt>Status</dt><dd><span className="application-status">{result.status.replaceAll("_", " ")}</span></dd></div><div><dt>Entry</dt><dd>{result.entryYearGroup?.replace("_", " ") ?? "To be confirmed"} · {result.entryAcademicYear}</dd></div><div><dt>Last updated</dt><dd>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(result.updatedAt))}</dd></div></dl></div> : <><p className="admission-kicker">Admissions 2026/2027</p><h2 id="track-title">Track an application</h2><p>Enter the application number issued when the application was submitted.</p><form onSubmit={submit} className="track-form"><Field label="Application number" required><input value={applicationNumber} required placeholder="ABC-APP-2026-XXXXXXXX" autoComplete="off" onChange={(event) => setApplicationNumber(event.target.value)} /></Field>{error && <div className="admission-error">{error}</div>}<button className="admission-primary" disabled={loading}>{loading ? "Checking…" : "Check status"}</button></form></>}</section></div>;
}

export function AdmissionsPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<AdmissionFormData>(initialAdmissionData);
  const [application, setApplication] = useState<AdmissionApplication | null>(null);
  const [token, setToken] = useState("");
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const [trackOpen, setTrackOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(draftStorageKey);
    if (!stored) { setRestoring(false); return; }
    try {
      const draft = JSON.parse(stored) as { id: string; token: string };
      getAdmissionApplication(draft.id, draft.token).then((result) => {
        setApplication(result); setToken(draft.token); setCurrentStep(result.currentStep);
        setData(normalizeAdmissionData(result.formData));
      }).catch(() => localStorage.removeItem(draftStorageKey)).finally(() => setRestoring(false));
    } catch { localStorage.removeItem(draftStorageKey); setRestoring(false); }
  }, []);

  const step = steps[currentStep - 1]!;
  const uploadedDocuments = application?.documents ?? [];
  const completion = Math.round((Math.min(currentStep, 8) / 8) * 100);
  const keyDates = useMemo(() => [
    ["Application deadline", "30 June 2026"], ["Entrance assessment", "12 July 2026"], ["Interview dates", "19-20 July 2026"],
    ["Offer letters", "1 August 2026"], ["Acceptance deadline", "15 August 2026"], ["Autumn term starts", "8 September 2026"],
  ], []);

  const setSection = <K extends AdmissionSection>(key: K, value: AdmissionFormData[K]) => setData((current) => ({ ...current, [key]: value }));

  async function saveAndContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      if (currentStep === 1) {
        const started = application
          ? { application: await saveAdmissionSection(application.id, token, "personal", data.personal), applicationToken: token }
          : await startAdmissionApplication(data.personal);
        let nextApplication = started.application;
        setToken(started.applicationToken);
        localStorage.setItem(draftStorageKey, JSON.stringify({ id: started.application.id, token: started.applicationToken }));
        if (passportPhoto && !started.application.documents.some((document) => document.category === "passport-photo")) {
          const uploaded = await uploadAdmissionDocument(started.application.id, started.applicationToken, "passport-photo", passportPhoto);
          nextApplication = { ...started.application, documents: [uploaded, ...started.application.documents] };
        }
        setApplication(nextApplication);
        setCurrentStep(2);
      } else if (application) {
        const updated = await saveAdmissionSection(application.id, token, step.key, data[step.key] as never);
        setApplication(updated);
        if (currentStep === 8) {
          const submitted = await submitAdmissionApplication(application.id, token);
          setApplication(submitted); localStorage.removeItem(draftStorageKey);
        } else setCurrentStep((value) => Math.min(8, value + 1));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught.message);
      else setError("We could not save this section. Check the details and try again.");
    } finally { setLoading(false); }
  }

  async function uploadFile(category: string, file: File) {
    if (!application) return;
    setLoading(true); setError("");
    try {
      const document = await uploadAdmissionDocument(application.id, token, category, file);
      setApplication((current) => current ? { ...current, documents: [document, ...current.documents.filter((item) => item.category !== category)] } : current);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The document could not be uploaded."); }
    finally { setLoading(false); }
  }

  if (restoring) return <div className="admissions-loader"><span className="spinner" /> Restoring your application…</div>;
  if (application?.status === "SUBMITTED") return <main className="submission-page"><div className="submission-panel"><img src="/abc-logo.png" alt="Adorable British College" /><span className="success-mark"><CheckCircle2 size={40} /></span><p className="admission-kicker">Application submitted</p><h1>Thank you, {application.firstName}.</h1><p>Your application has been received by the Admissions Team. Keep the application number below for future correspondence and tracking.</p><div className="application-number"><small>Application number</small><strong>{application.applicationNumber}</strong></div><div className="submission-actions"><button className="admission-secondary" onClick={() => setTrackOpen(true)}>Track application</button><Link className="admission-primary" to="/login">Login to portal</Link></div></div>{trackOpen && <TrackModal onClose={() => setTrackOpen(false)} />}</main>;

  return <div className="admissions-page">
    <header className="admissions-header"><Link to="/" className="admissions-brand"><img src="/abc-logo.png" alt="Adorable British College" /></Link><div className="admissions-header-actions"><button onClick={() => setTrackOpen(true)}>Already applied? <strong>Track Application</strong></button><Link to="/login" className="portal-login"><LockKeyhole size={17} /> Login to Portal</Link></div></header>
    <section className="admissions-hero"><div><p>Admissions 2026/2027</p><h1>Apply to Adorable British College</h1><span>Complete every section carefully. Fields marked * are required.</span></div><div className="entry-badges"><span>Year 7 Entry Open</span><span>Year 9 Entry Open</span><span>Year 12 Entry Open</span></div></section>
    <nav className="admissions-stepper" aria-label="Application progress">{steps.map((item, index) => <button key={item.key} className={`${index + 1 === currentStep ? "active" : ""} ${index + 1 < currentStep ? "complete" : ""}`} onClick={() => application && index + 1 < currentStep && setCurrentStep(index + 1)} disabled={!application || index + 1 >= currentStep}><span>{index + 1 < currentStep ? <Check size={17} /> : index + 1}</span><small>{item.label}</small></button>)}</nav>
    <div className="admissions-layout">
      <form className="admission-form-panel" onSubmit={saveAndContinue}>
        <SectionHeading step={step} />
        <div className="admission-form-body">{currentStep === 1 && <PersonalSection value={data.personal} onChange={(next) => setSection("personal", next)} photo={passportPhoto} setPhoto={setPassportPhoto} />}{currentStep === 2 && <EntrySection value={data.entry} onChange={(next) => setSection("entry", next)} />}{currentStep === 3 && <GuardiansSection value={data.guardians} onChange={(next) => setSection("guardians", next)} />}{currentStep === 4 && <AcademicSection value={data.academic} onChange={(next) => setSection("academic", next)} />}{currentStep === 5 && <MedicalSection value={data.medical} onChange={(next) => setSection("medical", next)} />}{currentStep === 6 && <EmergencySection value={data.emergency} onChange={(next) => setSection("emergency", next)} />}{currentStep === 7 && <DocumentsSection value={data.documents} onChange={(next) => setSection("documents", next)} documents={uploadedDocuments} onUpload={uploadFile} />}{currentStep === 8 && <DeclarationSection value={data.declaration} onChange={(next) => setSection("declaration", next)} application={application} />}{error && <div className="admission-error" role="alert">{error}</div>}</div>
        <footer className="admission-form-footer">{currentStep > 1 ? <button type="button" className="admission-secondary" onClick={() => setCurrentStep((value) => value - 1)}><ArrowLeft size={18} /> Back</button> : <span />}{application && <span className="draft-reference">Draft: {application.applicationNumber}</span>}<button className="admission-primary" disabled={loading}>{loading ? "Saving…" : currentStep === 8 ? "Submit application" : <>Save and continue <ArrowRight size={18} /></>}</button></footer>
      </form>
      <aside className="admissions-aside">
        <section className="checklist-panel"><div className="aside-title"><ClipboardCheck size={21} /><h2>Application Checklist</h2><strong>{currentStep} of 8</strong></div><div className="progress-track"><span style={{ width: `${completion}%` }} /></div><ol>{steps.map((item, index) => <li className={index + 1 === currentStep ? "active" : index + 1 < currentStep ? "complete" : ""} key={item.key}><span>{index + 1 < currentStep ? <Check size={14} /> : index + 1}</span>{item.label}<small>{index + 1 === currentStep ? "In progress" : index + 1 < currentStep ? "Complete" : ""}</small></li>)}</ol></section>
        <section className="key-dates-panel"><div className="aside-title"><CalendarDays size={21} /><h2>Key Dates</h2></div><dl>{keyDates.map(([label, value], index) => <div key={label}><dt>{label}</dt><dd className={index === 0 ? "urgent" : ""}>{value}</dd></div>)}</dl></section>
        <section className="help-panel"><HelpCircle size={22} /><div><h2>Need help?</h2><p>Contact the Admissions Office through the College's official telephone or email channels.</p></div></section>
      </aside>
    </div>
    <footer className="admissions-footer"><span><ShieldCheck size={16} /> Your information is encrypted and handled securely.</span><span>Adorable British College · Discipline · Excellence · Success</span></footer>
    {trackOpen && <TrackModal onClose={() => setTrackOpen(false)} />}
  </div>;
}

function PersonalSection({ value, onChange, photo, setPhoto }: { value: AdmissionFormData["personal"]; onChange: (next: AdmissionFormData["personal"]) => void; photo: File | null; setPhoto: (file: File | null) => void }) {
  const set = <K extends keyof typeof value>(key: K, next: typeof value[K]) => onChange({ ...value, [key]: next });
  return <><div className="form-grid"><Field label="Legal first name" required><input value={value.legalFirstName} required autoComplete="given-name" onChange={(e) => set("legalFirstName", e.target.value)} /></Field><Field label="Legal last name" required><input value={value.legalLastName} required autoComplete="family-name" onChange={(e) => set("legalLastName", e.target.value)} /></Field><Field label="Preferred / known as"><input value={value.preferredName} onChange={(e) => set("preferredName", e.target.value)} /></Field><Field label="Date of birth" required><input type="date" max={inputDate()} value={value.dateOfBirth} required onChange={(e) => set("dateOfBirth", e.target.value)} /></Field><Field label="Gender" required><Select value={value.gender} required onChange={(next) => set("gender", next as typeof value.gender)}><option value="" disabled>Select gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></Select></Field><Field label="Nationality" required><input list="nationalities" value={value.nationality} required onChange={(e) => set("nationality", e.target.value)} /></Field><Field label="Country of birth" required><input list="countries" value={value.countryOfBirth} required onChange={(e) => set("countryOfBirth", e.target.value)} /></Field><Field label="Religion"><input value={value.religion} onChange={(e) => set("religion", e.target.value)} /></Field><Field label="First language" required><input value={value.firstLanguage} required onChange={(e) => set("firstLanguage", e.target.value)} /></Field><Field label="Additional languages"><input value={value.additionalLanguages} onChange={(e) => set("additionalLanguages", e.target.value)} /></Field><Field label="Applicant / parent email" required><input type="email" value={value.applicantEmail} required autoComplete="email" onChange={(e) => set("applicantEmail", e.target.value)} /></Field><Field label="Applicant / parent mobile" required><input type="tel" value={value.applicantPhone} required autoComplete="tel" onChange={(e) => set("applicantPhone", e.target.value)} /></Field></div><Field label="Passport photograph" required wide hint="A clear, recent head-and-shoulders image. JPG or PNG, maximum 5 MB."><label className={`upload-zone ${photo ? "has-file" : ""}`}><Camera size={24} /><strong>{photo?.name ?? "Choose passport photograph"}</strong><span>{photo ? `${Math.round(photo.size / 1024)} KB selected` : "Select a file from your device"}</span><input type="file" accept="image/jpeg,image/png" required={!photo} onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label></Field><datalist id="countries"><option>Nigeria</option><option>United Kingdom</option><option>Ghana</option><option>South Africa</option><option>United States</option><option>Canada</option></datalist><datalist id="nationalities"><option>Nigerian</option><option>British</option><option>Ghanaian</option><option>South African</option><option>American</option><option>Canadian</option></datalist></>;
}

function EntrySection({ value, onChange }: { value: AdmissionFormData["entry"]; onChange: (next: AdmissionFormData["entry"]) => void }) { const set = <K extends keyof typeof value>(key: K, next: typeof value[K]) => onChange({ ...value, [key]: next }); return <div className="form-grid"><Field label="Academic year" required><input value={value.academicYear} readOnly /></Field><Field label="Year group applying for" required><Select value={value.yearGroup} required onChange={(next) => set("yearGroup", next as typeof value.yearGroup)}><option value="YEAR_7">Year 7</option><option value="YEAR_9">Year 9</option><option value="YEAR_12">Year 12 / Sixth Form</option></Select></Field><Field label="Entry term" required><Select value={value.entryTerm} required onChange={(next) => set("entryTerm", next as typeof value.entryTerm)}><option value="AUTUMN">Autumn term</option><option value="SPRING">Spring term</option><option value="SUMMER">Summer term</option></Select></Field><Field label="Pupil type" required><Select value={value.pupilType} required onChange={(next) => set("pupilType", next as typeof value.pupilType)}><option value="DAY">Day pupil</option><option value="BOARDING">Boarding pupil</option><option value="FLEXI_BOARDING">Flexi-boarding</option></Select></Field><Field label="Current school year / class" required><input value={value.currentSchoolYear} required placeholder="e.g. Year 6 or JSS 1" onChange={(e) => set("currentSchoolYear", e.target.value)} /></Field><Field label="Proposed start date" required><input type="date" value={value.proposedStartDate} required onChange={(e) => set("proposedStartDate", e.target.value)} /></Field></div>; }

function GuardiansSection({ value, onChange }: { value: AdmissionFormData["guardians"]; onChange: (next: AdmissionFormData["guardians"]) => void }) { return <><h3 className="form-subheading">Primary parent or guardian</h3><GuardianFields value={value.primaryGuardian} prefix="primary" onChange={(next) => onChange({ ...value, primaryGuardian: next })} /><div className="section-divider"><Choice label="Add a second parent or guardian" checked={value.addSecondGuardian} onChange={(next) => onChange({ ...value, addSecondGuardian: next })} /></div>{value.addSecondGuardian && <><h3 className="form-subheading">Second parent or guardian</h3><GuardianFields value={value.secondGuardian} prefix="second" onChange={(next) => onChange({ ...value, secondGuardian: next })} /></>}<div className="section-divider"><Choice label="There are custody, court order or access restrictions the school must know about" checked={value.custodyOrAccessRestrictions} onChange={(next) => onChange({ ...value, custodyOrAccessRestrictions: next })} /></div>{value.custodyOrAccessRestrictions && <Field label="Restriction details" required wide hint="Admissions staff will handle this information confidentially."><textarea required value={value.restrictionDetails} onChange={(e) => onChange({ ...value, restrictionDetails: e.target.value })} /></Field>}</>; }

function AcademicSection({ value, onChange }: { value: AdmissionFormData["academic"]; onChange: (next: AdmissionFormData["academic"]) => void }) { const set = <K extends keyof typeof value>(key: K, next: typeof value[K]) => onChange({ ...value, [key]: next }); return <div className="form-grid"><Field label="Current or previous school" required><input value={value.previousSchoolName} required onChange={(e) => set("previousSchoolName", e.target.value)} /></Field><Field label="School country" required><input value={value.previousSchoolCountry} required onChange={(e) => set("previousSchoolCountry", e.target.value)} /></Field><Field label="School address"><textarea value={value.previousSchoolAddress} onChange={(e) => set("previousSchoolAddress", e.target.value)} /></Field><Field label="Current year group" required><input value={value.currentYearGroup} required onChange={(e) => set("currentYearGroup", e.target.value)} /></Field><Field label="Attendance from" required><input type="date" value={value.attendanceFrom} required onChange={(e) => set("attendanceFrom", e.target.value)} /></Field><Field label="Attendance to"><input type="date" value={value.attendanceTo} onChange={(e) => set("attendanceTo", e.target.value)} /></Field><Field label="Curriculum" required><input value="Nigerian/British Blend." readOnly aria-readonly="true" /></Field><Field label="English proficiency" required><Select value={value.englishProficiency} required onChange={(next) => set("englishProficiency", next as typeof value.englishProficiency)}><option value="NATIVE">Native speaker</option><option value="FLUENT">Fluent</option><option value="INTERMEDIATE">Intermediate</option><option value="BEGINNER">Beginner</option></Select></Field><Field label="Headteacher / principal"><input value={value.headteacherName} onChange={(e) => set("headteacherName", e.target.value)} /></Field><Field label="School email"><input type="email" value={value.schoolEmail} onChange={(e) => set("schoolEmail", e.target.value)} /></Field><Field label="School telephone"><input type="tel" value={value.schoolPhone} onChange={(e) => set("schoolPhone", e.target.value)} /></Field><Field label="Reason for leaving" required><Select value={value.reasonForLeaving} required onChange={(next) => set("reasonForLeaving", next as typeof value.reasonForLeaving)}><option value="" disabled>Select a reason</option>{reasonForLeavingOptions.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</Select></Field><Field label="Learning strengths and interests" wide><textarea value={value.learningStrengths} onChange={(e) => set("learningStrengths", e.target.value)} /></Field><Field label="Previous learning support or intervention" wide><textarea value={value.supportHistory} onChange={(e) => set("supportHistory", e.target.value)} /></Field><div className="admission-field wide choice-stack"><Choice label="I give permission for the College to contact the current or previous school for a confidential reference" checked={value.permissionToContactSchool} onChange={(next) => set("permissionToContactSchool", next)} /></div></div>; }

function MedicalSection({ value, onChange }: { value: AdmissionFormData["medical"]; onChange: (next: AdmissionFormData["medical"]) => void }) { const set = <K extends keyof typeof value>(key: K, next: typeof value[K]) => onChange({ ...value, [key]: next }); return <div className="form-grid"><div className="privacy-notice wide"><ShieldCheck size={21} /><p>This information is restricted to authorised admissions and welfare staff and is used to plan appropriate support.</p></div><Field label="Doctor / clinic name"><input value={value.doctorName} onChange={(e) => set("doctorName", e.target.value)} /></Field><Field label="Doctor / clinic telephone"><input type="tel" value={value.doctorPhone} onChange={(e) => set("doctorPhone", e.target.value)} /></Field><Field label="Blood group"><input value={value.bloodGroup} placeholder="Optional" onChange={(e) => set("bloodGroup", e.target.value)} /></Field><Field label="Immunisations up to date" required><Select value={value.immunisationsUpToDate} required onChange={(next) => set("immunisationsUpToDate", next as typeof value.immunisationsUpToDate)}><option value="YES">Yes</option><option value="NO">No</option><option value="UNKNOWN">Not known</option></Select></Field><Field label="Medical conditions" wide><textarea value={value.medicalConditions} placeholder="Write None if there are no known conditions" onChange={(e) => set("medicalConditions", e.target.value)} /></Field><Field label="Allergies" wide><textarea value={value.allergies} placeholder="Include severity and action required" onChange={(e) => set("allergies", e.target.value)} /></Field><Field label="Regular medication" wide><textarea value={value.regularMedication} onChange={(e) => set("regularMedication", e.target.value)} /></Field><Field label="Dietary requirements" wide><textarea value={value.dietaryRequirements} onChange={(e) => set("dietaryRequirements", e.target.value)} /></Field><div className="admission-field wide choice-stack"><Choice label="The pupil has a disability, SEND need, learning plan or access arrangement" checked={value.disabilitiesOrSend} onChange={(next) => set("disabilitiesOrSend", next)} /></div>{value.disabilitiesOrSend && <Field label="SEND / learning support details" required wide><textarea required value={value.sendDetails} onChange={(e) => set("sendDetails", e.target.value)} /></Field>}<Field label="Mental health or welfare information" wide><textarea value={value.mentalHealthOrWelfareNeeds} onChange={(e) => set("mentalHealthOrWelfareNeeds", e.target.value)} /></Field><div className="admission-field wide choice-stack"><Choice label="I consent to emergency first aid and medical treatment when a parent or guardian cannot be contacted" required checked={value.emergencyTreatmentConsent} onChange={(next) => set("emergencyTreatmentConsent", next)} /></div></div>; }

function EmergencySection({ value, onChange }: { value: AdmissionFormData["emergency"]; onChange: (next: AdmissionFormData["emergency"]) => void }) { const updateContact = (index: number, patch: Partial<EmergencyContact>) => onChange({ ...value, contacts: value.contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...patch } : contact) }); return <>{value.contacts.map((contact, index) => <div className="contact-block" key={index}><div className="contact-block-title"><h3>Emergency contact {index + 1}</h3>{index > 0 && <button type="button" onClick={() => onChange({ ...value, contacts: value.contacts.filter((_, i) => i !== index) })}>Remove</button>}</div><div className="form-grid"><Field label="Full name" required><input value={contact.fullName} required onChange={(e) => updateContact(index, { fullName: e.target.value })} /></Field><Field label="Relationship to pupil" required><input value={contact.relationship} required onChange={(e) => updateContact(index, { relationship: e.target.value })} /></Field><Field label="Primary telephone" required><input type="tel" value={contact.primaryPhone} required onChange={(e) => updateContact(index, { primaryPhone: e.target.value })} /></Field><Field label="Alternative telephone"><input type="tel" value={contact.alternatePhone} onChange={(e) => updateContact(index, { alternatePhone: e.target.value })} /></Field><Field label="Email"><input type="email" value={contact.email} onChange={(e) => updateContact(index, { email: e.target.value })} /></Field><div className="admission-field choice-stack"><Choice label="Authorised to collect the pupil" checked={contact.authorisedToCollect} onChange={(next) => updateContact(index, { authorisedToCollect: next })} /></div></div></div>)}{value.contacts.length < 2 && <button type="button" className="add-contact" onClick={() => onChange({ ...value, contacts: [...value.contacts, { fullName: "", relationship: "", primaryPhone: "", alternatePhone: "", email: "", authorisedToCollect: false }] })}>+ Add another emergency contact</button>}<Field label="Collection or emergency notes" wide><textarea value={value.collectionNotes} onChange={(e) => onChange({ ...value, collectionNotes: e.target.value })} /></Field></>; }

function DocumentsSection({ value, onChange, documents, onUpload }: { value: AdmissionFormData["documents"]; onChange: (next: AdmissionFormData["documents"]) => void; documents: AdmissionDocument[]; onUpload: (category: string, file: File) => void }) { return <><div className="document-list">{documentRequirements.map((requirement) => { const uploaded = documents.find((document) => document.category === requirement.category); return <label className={`document-row ${uploaded ? "uploaded" : ""}`} key={requirement.category}><span className="document-icon">{uploaded ? <FileCheck2 size={20} /> : <Upload size={20} />}</span><span><strong>{requirement.label}{requirement.required && " *"}</strong><small>{uploaded ? uploaded.originalName : requirement.hint}</small></span><span className="document-action">{uploaded ? "Uploaded" : "Choose file"}</span><input type="file" required={requirement.required && !uploaded} accept="application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(requirement.category, file); }} /></label>; })}</div><Field label="Additional information for Admissions" wide><textarea value={value.additionalInformation} onChange={(event) => onChange({ additionalInformation: event.target.value })} /></Field></>; }

function DeclarationSection({ value, onChange, application }: { value: AdmissionFormData["declaration"]; onChange: (next: AdmissionFormData["declaration"]) => void; application: AdmissionApplication | null }) { const set = <K extends keyof typeof value>(key: K, next: typeof value[K]) => onChange({ ...value, [key]: next }); return <><div className="review-summary"><h3>Application summary</h3><dl><div><dt>Applicant</dt><dd>{application?.firstName} {application?.lastName}</dd></div><div><dt>Application number</dt><dd>{application?.applicationNumber}</dd></div><div><dt>Entry</dt><dd>{application?.entryYearGroup?.replace("_", " ") ?? "Not selected"} · 2026/2027</dd></div><div><dt>Documents</dt><dd>{application?.documents.length ?? 0} uploaded</dd></div></dl></div><div className="declaration-list"><Choice required label="I confirm that the information supplied is complete and accurate to the best of my knowledge." checked={value.informationAccurate} onChange={(next) => set("informationAccurate", next)} /><Choice required label="I confirm that I have parental responsibility or lawful authority to submit this application." checked={value.parentalResponsibilityConfirmed} onChange={(next) => set("parentalResponsibilityConfirmed", next)} /><Choice required label="I have read and accept the College privacy notice and understand how applicant data will be processed." checked={value.privacyNoticeAccepted} onChange={(next) => set("privacyNoticeAccepted", next)} /><Choice required label="I accept the admissions terms and understand that submission does not guarantee an offer of a place." checked={value.admissionsTermsAccepted} onChange={(next) => set("admissionsTermsAccepted", next)} /><Choice label="I consent to receiving information about College events and future admissions opportunities. This is optional." checked={value.marketingConsent} onChange={(next) => set("marketingConsent", next)} /></div><div className="form-grid declaration-signature"><Field label="Full name of signatory" required><input value={value.signatoryName} required onChange={(event) => set("signatoryName", event.target.value)} /></Field><Field label="Relationship to pupil" required><input value={value.signatoryRelationship} required onChange={(event) => set("signatoryRelationship", event.target.value)} /></Field><Field label="Date" required><input type="date" max={inputDate()} value={value.signedOn} required onChange={(event) => set("signedOn", event.target.value)} /></Field></div></>; }
