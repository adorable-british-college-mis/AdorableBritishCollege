import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarCheck, CheckCircle2, ClipboardCheck, Download,
  FileCheck2, FileText, Filter, GraduationCap, Home, Hourglass, Mail, Plus, Search,
  Info, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { useDeferredValue, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ApiError, downloadAdminAdmissionDocument, enrolAdmission, getAdminAdmission,
  getAdminAdmissions, getDashboardSummary, transitionAdmission,
} from "../../lib/api";
import type { AdmissionDocument } from "../admissions/admissions-types";
import type { AdmissionStatus } from "./admissions-admin-types";
import "./admissions-admin.css";

const statusLabels: Record<AdmissionStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", ASSESSMENT: "Assessment",
  INTERVIEW: "Interview", OFFERED: "Offer issued", WAITLISTED: "Waiting list", ACCEPTED: "Accepted",
  REJECTED: "Not offered", WITHDRAWN: "Withdrawn", ENROLLED: "Enrolled",
};

const nextStatuses: Partial<Record<AdmissionStatus, AdmissionStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["ASSESSMENT", "INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  ASSESSMENT: ["INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["ACCEPTED", "WITHDRAWN"],
  WAITLISTED: ["OFFERED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["WITHDRAWN"],
};

const formatDate = (value?: string, withTime = false) => value
  ? new Intl.DateTimeFormat("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value))
  : "Not recorded";
const statusTone = (status: AdmissionStatus) => ["ACCEPTED", "ENROLLED"].includes(status) ? "green" : ["SUBMITTED", "UNDER_REVIEW"].includes(status) ? "blue" : ["ASSESSMENT", "INTERVIEW", "OFFERED", "WAITLISTED"].includes(status) ? "gold" : status === "REJECTED" ? "red" : "neutral";
const displayYear = (value?: string) => value?.replace("YEAR_", "Year ") ?? "Not selected";
const overviewTrend = (value: number | null) => <div className="admissions-trend"><span className={value != null && value < 0 ? "negative" : "positive"}>{value == null ? "—" : `${value >= 0 ? "▲ +" : "▼ "}${value}%`}</span><small>vs. last year</small></div>;
const donutBackground = (groups: Array<{ count: number }>, total: number) => {
  if (!total) return "#e8edf3";
  const colours = ["#8b5cf6", "#4f8ddf", "#50bd83", "#f1bd4d", "#ef6464", "#58b7c4"];
  let offset = 0;
  return `conic-gradient(${groups.map((group, index) => { const start = offset; offset += group.count / total * 100; return `${colours[index % colours.length]} ${start}% ${offset}%`; }).join(", ")})`;
};

export function AdmissionsAdminPage() {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const deferredSearch = useDeferredValue(search);
  const routeStatus: Partial<Record<string, AdmissionStatus>> = { "/admissions/offers": "OFFERED", "/admissions/waiting-list": "WAITLISTED", "/admissions/enrolments": "ENROLLED" };
  const selectedStatus = routeStatus[location.pathname] ?? status;
  const isOverview = location.pathname === "/admissions" || location.pathname === "/admissions/overview";
  const isEnrolments = location.pathname === "/admissions/enrolments";
  const pageTitle = location.pathname === "/admissions/offers" ? "Offers" : location.pathname === "/admissions/waiting-list" ? "Waiting List" : isEnrolments ? "Enrolments" : "Applications";
  const query = useQuery({ queryKey: ["admin-admissions", deferredSearch, selectedStatus, yearGroup], queryFn: () => getAdminAdmissions({ search: deferredSearch, status: selectedStatus, yearGroup }) });
  const dashboard = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const summary = query.data?.summary ?? { total: 0, enquiries: 0, submitted: 0, inReview: 0, interview: 0, offered: 0, accepted: 0, waitlisted: 0, enrolled: 0, yearGroups: [], sources: [], trends: { enquiries: null, applications: null, offered: null, enrolled: null, waitlisted: null } };
  const academicYear = dashboard.data?.academicYear?.name ?? query.data?.items[0]?.entryAcademicYear ?? "Not configured";
  const applications = query.data?.items ?? [];
  const metrics = isOverview
    ? [{ label: "Total Enquiries", value: summary.enquiries, trend: summary.trends.enquiries, icon: Users, tone: "purple" }, { label: "Applications", value: summary.total, trend: summary.trends.applications, icon: FileCheck2, tone: "blue" }, { label: "Offers Made", value: summary.offered, trend: summary.trends.offered, icon: CheckCircle2, tone: "green" }, { label: "Enrolled", value: summary.enrolled, trend: summary.trends.enrolled, icon: UserPlus, tone: "amber" }, { label: "Waiting List", value: summary.waitlisted, trend: summary.trends.waitlisted, icon: Hourglass, tone: "red" }]
    : isEnrolments
      ? [{ label: "Total Enrolled", value: summary.enrolled, note: "Confirmed learner records", icon: Users, tone: "green" }, { label: "Pending Completion", value: summary.accepted, note: "Accepted, awaiting enrolment", icon: Hourglass, tone: "amber" }, { label: "Fully Confirmed", value: summary.enrolled, note: "Learner record created", icon: ShieldCheck, tone: "blue" }, { label: "Starting Current Year", value: summary.enrolled, note: academicYear, icon: CalendarCheck, tone: "green" }, { label: "Deferred", value: summary.waitlisted, note: "Waiting-list records", icon: ClipboardCheck, tone: "red" }]
      : [{ label: "Total Applications", value: summary.total, note: "Submitted applications", icon: FileCheck2, tone: "blue" }, { label: "Under Review", value: summary.submitted + summary.inReview, note: "Awaiting decision", icon: Hourglass, tone: "amber" }, { label: "Interview Scheduled", value: summary.interview, note: "Current pipeline", icon: CalendarCheck, tone: "purple" }, { label: "Offers Made", value: summary.offered, note: "Awaiting response", icon: CheckCircle2, tone: "green" }, { label: "Enrolled", value: summary.enrolled, note: "Confirmed places", icon: UserPlus, tone: "green" }];
  const funnelStages = [{ label: "Enquiries", detail: "Initial enquiries received", value: summary.enquiries }, { label: "Applications", detail: "Applications submitted", value: summary.total }, { label: "Offers", detail: "Offers made to applicants", value: summary.offered }, { label: "Enrolled", detail: "Successfully enrolled", value: summary.enrolled }];
  const funnelBaseline = Math.max(...funnelStages.map((stage) => stage.value), 0);

  const table = <section className="directory-section admissions-records-card"><div className="section-heading"><div><h2>{isEnrolments ? "Confirmed Enrolments" : isOverview ? "Recent Applications" : "All Applications"}</h2><p>{query.data?.pagination.total ?? 0} live records for {academicYear}</p></div>{isOverview && <Link className="view-details-link" to="/admissions/applications">View all applications <ArrowRight size={14} /></Link>}</div>{query.isError ? <div className="empty-state compact"><ShieldCheck size={30} /><h2>Records are unavailable</h2><p>{query.error instanceof ApiError ? query.error.message : "The admissions records could not be loaded."}</p><button className="secondary-button" onClick={() => void query.refetch()}>Retry</button></div> : <div className="table-scroll"><table className="admissions-table"><thead><tr><th>{isEnrolments ? "Ref #" : "Application"}</th><th>Applicant</th><th>Year Group</th><th>Parent / Guardian</th><th>{isEnrolments ? "Documents" : "Application Date"}</th><th>{isEnrolments ? "Record" : "Source"}</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{query.isLoading && <tr><td colSpan={8}>Loading live records...</td></tr>}{applications.map((application) => <tr key={application.id}><td className="mono">{application.applicationNumber}</td><td><div className="student-cell"><span className="student-avatar">{application.firstName[0]}{application.lastName[0]}</span><strong>{application.firstName} {application.lastName}</strong></div></td><td>{displayYear(application.entryYearGroup)}</td><td>{application.parentGuardian ?? "Not provided"}</td><td>{isEnrolments ? `${application.documentCount} uploaded` : formatDate(application.submittedAt)}</td><td>{isEnrolments ? (application.studentId ? "Created" : "Pending") : application.source}</td><td><span className={`status-pill ${statusTone(application.status)}`}>{statusLabels[application.status]}</span></td><td><Link className="icon-button" to={`/admissions/${application.id}`} aria-label={`Review ${application.firstName} ${application.lastName}`}><ArrowRight size={18} /></Link></td></tr>)}</tbody></table>{!query.isLoading && applications.length === 0 && <div className="empty-state compact"><Users size={30} /><h2>No records found</h2><p>Adjust the filters or begin a new application.</p></div>}</div>}{query.data && <div className="table-footer"><span>Showing {applications.length} of {query.data.pagination.total} records</span></div>}</section>;

  return <div className="admin-page-container admissions-admin-page"><div className="breadcrumb-nav"><Home size={14} /><span>Admissions</span>{!isOverview && <><span>/</span><span>{pageTitle}</span></>}</div><div className="admin-page-header"><div className="admin-page-title-group"><h1>{isOverview ? "Admissions Overview" : pageTitle}</h1><p>{isEnrolments ? `Manage confirmed student enrolments for Academic Year ${academicYear}.` : `Track and manage the admissions pipeline for Academic Year ${academicYear}.`}</p></div><div className="admin-header-actions"><div className="context-select"><CalendarCheck size={16} /><span>Academic Year {academicYear}</span></div><Link className="primary-button" to="/" target="_blank"><Plus size={17} /> {isEnrolments ? "Enrol Student" : "New Application"}</Link></div></div>
    <section className="admissions-5-kpi-grid">{metrics.map((metric) => { const Icon = metric.icon; return <article className="kpi-card" key={metric.label}><div className="kpi-card-top"><div className={`kpi-icon-wrap ${metric.tone}`}><Icon size={21} /></div><div className="kpi-data-wrap"><span className="kpi-label">{metric.label}</span><span className="kpi-value">{query.isLoading ? "—" : metric.value}</span>{"trend" in metric ? overviewTrend(metric.trend ?? null) : <small>{metric.note}</small>}</div></div></article>; })}</section>
    {isOverview && <div className="admissions-overview-grid"><section className="dashboard-card admissions-funnel-card"><div className="card-header-row"><div className="card-title-group"><Filter size={18} /><h2>Admissions Pipeline</h2></div><Link className="view-details-link" to="/reports">View Full Report <ArrowRight size={14}/></Link></div><div className="funnel-container">{funnelStages.map((stage, index) => { const width = funnelBaseline ? Math.max(16, stage.value / funnelBaseline * 100) : 16; return <div className="funnel-stage-row" key={stage.label}><div className="funnel-visual"><div className={`funnel-segment funnel-bar-${index + 1}`} style={{ "--funnel-width": `${width}%` } as CSSProperties}>{stage.value}</div></div><div className="funnel-label-info"><strong>{stage.label}</strong><small>{stage.detail}</small></div><strong className="funnel-stat">{stage.value}</strong><span className="funnel-percent">{funnelBaseline ? `${Math.round(stage.value / funnelBaseline * 100)}%` : "—"}</span></div>; })}</div></section><section className="dashboard-card admissions-year-card"><div className="card-header-row"><div className="card-title-group"><GraduationCap size={18}/><h2>Applications by Year Group</h2></div></div><div className="admissions-donut-layout"><div className="admissions-donut" style={{ background: donutBackground(summary.yearGroups, summary.total) }}><span><strong>{summary.total}</strong><small>Total</small></span></div><div className="sources-list">{summary.yearGroups.map((group, index) => <div className="source-row" key={group.name}><span className="source-label"><i className={`source-colour source-${index % 6}`}/>{group.name}</span><span><strong>{group.count}</strong> <small>({summary.total ? Math.round(group.count / summary.total * 100) : 0}%)</small></span></div>)}{!summary.yearGroups.length && <p className="empty-copy">No application records yet.</p>}</div></div></section><aside className="admissions-overview-side"><section className="quick-student-actions-card"><h2><Plus size={18}/> Quick Actions</h2><div className="action-cards-stack"><Link className="quick-action-tile" to="/" target="_blank"><span className="quick-tile-icon purple"><UserPlus/></span><span className="quick-tile-text"><strong>Add New Enquiry</strong><small>Record a new enquiry</small></span><ArrowRight size={16}/></Link><Link className="quick-action-tile" to="/" target="_blank"><span className="quick-tile-icon blue"><FileCheck2/></span><span className="quick-tile-text"><strong>Add Application</strong><small>Create a new application</small></span><ArrowRight size={16}/></Link><Link className="quick-action-tile" to="/communication"><span className="quick-tile-icon green"><Mail/></span><span className="quick-tile-text"><strong>Send Communication</strong><small>Email applicants or parents</small></span><ArrowRight size={16}/></Link><Link className="quick-action-tile" to="/reports"><span className="quick-tile-icon amber"><BarChart3/></span><span className="quick-tile-text"><strong>Generate Report</strong><small>Admissions summary report</small></span><ArrowRight size={16}/></Link></div></section><section className="dashboard-card application-sources-card"><div className="card-header-row"><div className="card-title-group"><h2>Application Sources</h2></div><Link className="view-details-link" to="/reports">View Report <ArrowRight size={14}/></Link></div><div className="sources-list">{summary.sources.map((source, index) => <div className="source-row" key={source.name}><span className="source-label"><i className={`source-colour source-${index % 6}`}/>{source.name}</span><span><strong>{source.count}</strong> <small>({summary.total ? Math.round(source.count / summary.total * 100) : 0}%)</small></span></div>)}{!summary.sources.length && <p className="empty-copy">No source records yet.</p>}</div></section><div className="timezone-note"><Info size={17}/> All dates are in your school&apos;s local time zone.</div></aside></div>}
    {!isOverview && <section className="admissions-filter-card"><div className="card-title-group"><Filter size={18} /><h2>Filter {isEnrolments ? "enrolments" : "applications"}</h2></div><div className="admissions-filter-row"><div className="search-input-box"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant name or reference" /></div><select className="filter-select" value={yearGroup} onChange={(event) => setYearGroup(event.target.value)}><option value="">All Year Groups</option><option value="YEAR_7">Year 7</option><option value="YEAR_9">Year 9</option><option value="YEAR_12">Year 12</option></select><select className="filter-select" value={selectedStatus} disabled={Boolean(routeStatus[location.pathname])} onChange={(event) => setStatus(event.target.value)}><option value="">All Stages</option>{Object.entries(statusLabels).filter(([key]) => key !== "DRAFT").map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><button className="secondary-button" onClick={() => { setSearch(""); setYearGroup(""); setStatus(""); }}>Clear</button></div></section>}
    {isEnrolments && <section className="enrolment-pipeline-card"><div className="section-heading"><div><p className="eyebrow">Progress overview</p><h2>Enrolment Pipeline</h2></div></div><div className="enrolment-pipeline">{[{ label: "Offer Issued", value: summary.offered }, { label: "Offer Accepted", value: summary.accepted }, { label: "Learner Created", value: summary.enrolled }].map((stage) => <div key={stage.label}><strong>{stage.value}</strong><span>{stage.label}</span></div>)}</div></section>}
    {table}
  </div>;
}

function flattenDetails(value: unknown, prefix = ""): Array<[string, string]> {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const label = `${prefix}${key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase())}`;
    if (item && typeof item === "object" && !Array.isArray(item)) return flattenDetails(item, `${label} - `);
    if (Array.isArray(item)) return [[label, item.map((entry) => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join(", ")]];
    if (typeof item === "boolean") return [[label, item ? "Yes" : "No"]];
    return [[label, item === "" || item == null ? "Not provided" : String(item).replaceAll("_", " ")]];
  });
}

function ApplicationSection({ title, value }: { title: string; value: unknown }) {
  const rows = flattenDetails(value);
  if (!rows.length) return null;
  return <details className="application-section" open={title === "Personal details" || title === "Parent and guardian"}><summary>{title}<span>{rows.length} fields</span></summary><dl className="application-data">{rows.map(([label, entry]) => <div key={label}><dt>{label}</dt><dd>{entry}</dd></div>)}</dl></details>;
}

export function AdmissionReviewPage() {
  const { applicationId = "" } = useParams();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-admission", applicationId], queryFn: () => getAdminAdmission(applicationId), enabled: Boolean(applicationId) });
  const application = query.data;
  const [targetStatus, setTargetStatus] = useState<AdmissionStatus | "">("");
  const [note, setNote] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [score, setScore] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const transition = useMutation({ mutationFn: () => transitionAdmission(applicationId, { targetStatus: targetStatus as AdmissionStatus, note, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}), ...(score ? { score: Number(score) } : {}) }), onSuccess: async () => { setTargetStatus(""); setNote(""); setScheduledAt(""); setScore(""); await client.invalidateQueries({ queryKey: ["admin-admission", applicationId] }); await client.invalidateQueries({ queryKey: ["admin-admissions"] }); } });
  const enrol = useMutation({ mutationFn: () => enrolAdmission(applicationId, { ...(admissionNumber ? { admissionNumber } : {}), ...(startsOn ? { startsOn } : {}) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["admin-admission", applicationId] }); await client.invalidateQueries({ queryKey: ["admin-admissions"] }); } });
  const sections = useMemo(() => application ? [
    ["Personal details", application.formData.personal], ["Year group and entry", application.formData.entry], ["Parent and guardian", application.formData.guardians],
    ["Academic background", application.formData.academic], ["Medical and welfare", application.formData.medical], ["Emergency contacts", application.formData.emergency],
    ["Supporting information", application.formData.documents], ["Declaration", application.formData.declaration],
  ] as const : [], [application]);

  async function download(document: AdmissionDocument) { setDownloadError(""); try { await downloadAdminAdmissionDocument(applicationId, document); } catch (error) { setDownloadError(error instanceof ApiError ? error.message : "The document could not be downloaded."); } }
  function submitTransition(event: FormEvent) { event.preventDefault(); if (targetStatus) transition.mutate(); }
  function submitEnrolment(event: FormEvent) { event.preventDefault(); enrol.mutate(); }

  if (query.isLoading) return <div className="page-loader"><span className="spinner" /> Loading application</div>;
  if (!application || query.isError) return <div className="page"><div className="empty-state"><ShieldCheck size={32} /><h2>Application unavailable</h2><p>{query.error instanceof ApiError ? query.error.message : "The application could not be loaded."}</p><Link className="secondary-button" to="/admissions">Back to admissions</Link></div></div>;

  const availableStatuses = nextStatuses[application.status] ?? [];
  return <div className="page admission-review-page">
    <Link className="back-link" to="/admissions"><ArrowLeft size={16} /> Admissions pipeline</Link>
    <div className="review-heading"><div><p className="eyebrow">{application.applicationNumber}</p><h1>{application.firstName} {application.lastName}</h1><p>{displayYear(application.entryYearGroup)} entry · {application.entryAcademicYear} · submitted {formatDate(application.submittedAt)}</p></div><span className={`status-pill large ${statusTone(application.status)}`}>{statusLabels[application.status]}</span></div>
    <div className="review-layout"><div className="review-main">
      <section className="content-section applicant-overview"><div className="section-heading"><div><h2>Applicant overview</h2><p>Core identity and application contact details.</p></div></div><dl className="overview-grid"><div><dt>Date of birth</dt><dd>{formatDate(application.dateOfBirth)}</dd></div><div><dt>Email</dt><dd>{application.email}</dd></div><div><dt>Mobile</dt><dd>{application.phone ?? "Not recorded"}</dd></div><div><dt>Entry year</dt><dd>{displayYear(application.entryYearGroup)}</dd></div>{application.student && <div><dt>Admission number</dt><dd><Link to={`/students`}>{application.student.admissionNumber}</Link></dd></div>}</dl></section>
      <section className="content-section application-record"><div className="section-heading"><div><h2>Application record</h2><p>Information supplied and declared by the family.</p></div></div><div className="application-sections">{sections.map(([title, value]) => <ApplicationSection title={title} value={value} key={title} />)}</div></section>
      <section className="content-section"><div className="section-heading"><div><h2>Supporting documents</h2><p>Private files supplied with this application.</p></div></div><div className="admin-document-list">{application.documents.map((document) => <button className="admin-document-row" key={document.id} onClick={() => void download(document)}><span><FileText size={19} /></span><div><strong>{document.originalName}</strong><small>{document.category.replaceAll("-", " ")} · {Math.ceil(document.sizeBytes / 1024)} KB</small></div><Download size={18} /></button>)}{application.documents.length === 0 && <p className="empty-copy">No supporting documents were supplied.</p>}</div>{downloadError && <div className="form-error section-error">{downloadError}</div>}</section>
    </div><aside className="review-sidebar">
      <section className="decision-panel"><div className="section-heading"><div><h2>Admissions decision</h2><p>Move this application through the approved workflow.</p></div></div>{application.status === "ACCEPTED" ? <form className="decision-form" onSubmit={submitEnrolment}><label>Admission number <input value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} placeholder="Generated automatically" /></label><label>Start date <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><button className="primary-button" disabled={enrol.isPending}><GraduationCap size={18} />{enrol.isPending ? "Creating learner..." : "Enrol learner"}</button>{enrol.isError && <div className="form-error">{enrol.error instanceof ApiError ? enrol.error.message : "The learner could not be enrolled."}</div>}</form> : availableStatuses.length ? <form className="decision-form" onSubmit={submitTransition}><label>Next stage <select required value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as AdmissionStatus)}><option value="">Select an outcome</option>{availableStatuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>{["ASSESSMENT", "INTERVIEW"].includes(targetStatus) && <label>Appointment date and time <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>}{["ASSESSMENT", "INTERVIEW"].includes(application.status) && <label>Score (%) <input type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} /></label>}<label>Decision note <textarea value={note} required={["WAITLISTED", "REJECTED", "WITHDRAWN"].includes(targetStatus)} onChange={(event) => setNote(event.target.value)} placeholder="Record the evidence and decision rationale" /></label><button className="primary-button" disabled={!targetStatus || transition.isPending}><CalendarCheck size={18} />{transition.isPending ? "Saving..." : "Save decision"}</button>{transition.isError && <div className="form-error">{transition.error instanceof ApiError ? transition.error.message : "The decision could not be saved."}</div>}</form> : <div className="decision-complete"><CheckCircle2 size={24} /><strong>{application.status === "ENROLLED" ? "Enrolment complete" : "Workflow complete"}</strong><p>No further admissions actions are available for this status.</p></div>}</section>
      <section className="content-section timeline-panel"><div className="section-heading"><div><h2>Application history</h2><p>Audited workflow events.</p></div></div><ol className="workflow-timeline">{application.workflowEvents.map((event) => <li key={event.id}><span /><div><strong>{statusLabels[event.toStatus]}</strong><time>{formatDate(event.createdAt, true)}</time>{event.note && <p>{event.note}</p>}{event.metadata?.scheduledAt && <small>Scheduled {formatDate(event.metadata.scheduledAt, true)}</small>}{event.metadata?.score !== undefined && <small>Score {event.metadata.score}%</small>}<em>{event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "Applicant"}</em></div></li>)}</ol></section>
    </aside></div>
  </div>;
}
