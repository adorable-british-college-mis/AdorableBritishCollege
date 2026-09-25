import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive, ArrowRight, BarChart3, BookOpen, CalendarDays,
  Download, Eye, FileBarChart, FileText, GraduationCap, Home, MoreVertical,
  Search, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Users, X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  ApiError, archiveGeneratedReport, downloadGeneratedReport, generateReport, getReportsOverview,
} from "../../lib/api";
import type { GeneratedReport, ReportType } from "../../types";

const reportMeta: Record<ReportType, { label: string; short: string; colour: string; icon: ReactNode }> = {
  ACADEMIC: { label: "Academic Report", short: "Academic Reports", colour: "#2f80ed", icon: <BookOpen /> },
  ATTENDANCE: { label: "Attendance Report", short: "Attendance Reports", colour: "#7b3ff2", icon: <CalendarDays /> },
  BEHAVIOUR: { label: "Behaviour Report", short: "Behaviour Reports", colour: "#18a66a", icon: <ShieldCheck /> },
  STUDENT: { label: "Student Report", short: "Student Reports", colour: "#f3ad25", icon: <Users /> },
  EXAM: { label: "Exam Report", short: "Examination Reports", colour: "#ef4f81", icon: <GraduationCap /> },
  OTHER: { label: "Data Export", short: "Other Reports", colour: "#8c98aa", icon: <Download /> },
};
const subjects = ["Mathematics", "English", "Science"] as const;
const subjectColours = ["#2f80ed", "#7b3ff2", "#29bd7f"];
const emptyFilters = { academicYearId: "", termId: "", yearGroupId: "", studentId: "", type: "" as ReportType | "" };

function Kpi({ icon, label, value, trend, tone }: { icon: ReactNode; label: string; value: string | number; trend: number | null; tone: string }) {
  const negative = trend != null && trend < 0;
  return <article className="reports-kpi"><span className={`reports-kpi-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p className={negative ? "down" : "up"}>{trend == null ? null : negative ? <TrendingDown /> : <TrendingUp />}{trend == null ? "No comparison" : `${trend > 0 ? "+" : ""}${trend}%`}<em>vs. last term</em></p></div><ArrowRight className="reports-kpi-arrow" /></article>;
}

function Donut({ values, colours, centre, sub }: { values: number[]; colours: string[]; centre: string; sub: string }) {
  const total = values.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  const stops = values.map((value, index) => {
    const start = cursor;
    cursor += total ? value / total * 100 : 0;
    return `${colours[index]} ${start}% ${cursor}%`;
  });
  const background = total ? `conic-gradient(${stops.join(",")})` : "#e8edf4";
  return <div className="reports-donut" style={{ background }} title={`${centre} ${sub}`}><span><strong>{centre}</strong><small>{sub}</small></span></div>;
}

function PerformanceChart({ rows }: { rows: Awaited<ReturnType<typeof getReportsOverview>>["academicPerformance"] }) {
  return <section className="reports-panel performance-report"><header><div><h2><Users />Academic Performance</h2><p>Average attainment across all year groups</p></div><div className="chart-legend">{subjects.map((subject, index) => <span key={subject}><i style={{ background: subjectColours[index] }} />{subject === "Mathematics" ? "Maths" : subject}</span>)}</div></header><div className="performance-chart"><div className="chart-y-axis">{[100, 80, 60, 40, 20, 0].map((value) => <span key={value}>{value}</span>)}</div><div className="performance-bars">{rows.map((row) => <div className="performance-group" key={row.id}><div>{row.subjects.map((subject, index) => <i key={subject.subject} style={{ height: `${Math.max(2, subject.value ?? 0)}%`, background: subjectColours[index] }} title={`${row.name} · ${subject.subject}: ${subject.value == null ? "No data" : `${subject.value}%`}`} />)}</div><span>{row.name.replace("Year ", "Year ")}</span></div>)}{!rows.length && <p className="reports-empty-chart">No academic results match these filters.</p>}</div></div></section>;
}

function AttendanceChart({ rows, overall }: { rows: Awaited<ReturnType<typeof getReportsOverview>>["attendanceByYearGroup"]; overall: number | null }) {
  const colours = ["#2f80ed", "#a43cf0", "#2ac17d", "#f5b72e", "#f05278", "#62c4d8"];
  const values = rows.map((row) => row.percentage ?? 0);
  return <section className="reports-panel attendance-report"><header><div><h2><ShieldCheck />Attendance Overview</h2><p>Overall attendance rate by year group</p></div></header><div className="attendance-report-body"><Donut values={values} colours={colours} centre={overall == null ? "—" : `${overall}%`} sub="Overall" /><div>{rows.map((row, index) => <span key={row.id} title={`${row.name}: ${row.percentage == null ? "No attendance marks" : `${row.percentage}%`}`}><i style={{ background: colours[index % colours.length] }} /><b>{row.name}</b><strong>{row.percentage == null ? "—" : `${row.percentage}%`}</strong></span>)}</div></div></section>;
}

function TrendChart({ rows }: { rows: Awaited<ReturnType<typeof getReportsOverview>>["reportTrends"] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const points = rows.map((row, index) => `${10 + index * 18},${88 - row.count / max * 70}`).join(" ");
  return <section className="reports-panel trend-report"><header><div><h2><TrendingUp />Report Trends</h2><p>Monthly report generation trend</p></div></header><div className="trend-svg"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Reports generated by month"><polyline points={points} fill="none" stroke="#2f80ed" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />{rows.map((row, index) => <circle key={row.key} cx={10 + index * 18} cy={88 - row.count / max * 70} r="2.3" fill="#2f80ed"><title>{row.label}: {row.count} reports</title></circle>)}</svg><div>{rows.map((row) => <span key={row.key}>{row.label}</span>)}</div></div></section>;
}

function DistributionChart({ rows }: { rows: Awaited<ReturnType<typeof getReportsOverview>>["reportDistribution"] }) {
  const active = rows.filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="reports-panel distribution-report"><header><div><h2><Sparkles />Report Distribution</h2><p>Types of reports generated</p></div></header><div className="distribution-body"><div>{rows.map((row) => { const meta = reportMeta[row.type]; return <span key={row.type}><i style={{ background: meta.colour }} /><b>{meta.short}</b><strong>{total ? `${Math.round(row.count / total * 100)}%` : "0%"}</strong></span>; })}</div><Donut values={active.map((row) => row.count)} colours={active.map((row) => reportMeta[row.type].colour)} centre={String(total)} sub="Total" /></div></section>;
}

function Snapshot({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <div className="report-snapshot-list">{value.map((item, index) => <Snapshot key={index} value={item} />)}</div>;
  if (value && typeof value === "object") return <dl className="report-snapshot">{Object.entries(value).filter(([key]) => key !== "id").map(([key, item]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{item && typeof item === "object" ? <Snapshot value={item} /> : item == null ? "No data" : String(item)}</dd></div>)}</dl>;
  return <span>{String(value ?? "No data")}</span>;
}

export function ReportsPage() {
  const client = useQueryClient();
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [modalType, setModalType] = useState<ReportType | null>(null);
  const [reportName, setReportName] = useState("");
  const [selected, setSelected] = useState<GeneratedReport | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<GeneratedReport | null>(null);
  const [notice, setNotice] = useState("");
  const queryFilters = useMemo(() => ({
    academicYearId: filters.academicYearId || undefined,
    termId: filters.termId || undefined,
    yearGroupId: filters.yearGroupId || undefined,
    studentId: filters.studentId || undefined,
    type: filters.type || undefined,
  }), [filters]);
  const overview = useQuery({ queryKey: ["reports-overview", queryFilters], queryFn: () => getReportsOverview(queryFilters) });
  const data = overview.data;
  const generate = useMutation({
    mutationFn: (type: ReportType) => generateReport({
      type,
      name: reportName || undefined,
      academicYearId: queryFilters.academicYearId,
      termId: queryFilters.termId,
      yearGroupId: queryFilters.yearGroupId,
      studentId: queryFilters.studentId,
    }),
    onSuccess: async (report) => { setModalType(null); setReportName(""); setNotice(`${report.name} generated successfully.`); await client.invalidateQueries({ queryKey: ["reports-overview"] }); },
    onError: (error) => setNotice(error instanceof ApiError ? error.message : "The report could not be generated."),
  });
  const archive = useMutation({
    mutationFn: () => archiveTarget ? archiveGeneratedReport(archiveTarget.id) : Promise.resolve(null),
    onSuccess: async () => { setArchiveTarget(null); setNotice("Report archived successfully."); await client.invalidateQueries({ queryKey: ["reports-overview"] }); },
    onError: (error) => setNotice(error instanceof ApiError ? error.message : "The report could not be archived."),
  });
  async function download(report: GeneratedReport) {
    try {
      const result = await downloadGeneratedReport(report.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
      setNotice(`${report.name} downloaded.`);
    } catch (error) { setNotice(error instanceof ApiError ? error.message : "The report could not be downloaded."); }
  }
  const selectedYear = data?.reference.academicYears.find((year) => year.id === draftFilters.academicYearId) ?? data?.academicYear;
  const quick: ReportType[] = ["ACADEMIC", "ATTENDANCE", "BEHAVIOUR", "OTHER"];
  return <div className="admin-page-container reports-page">
    <div className="breadcrumb-nav"><Home size={14} /><span>/</span><strong>Reports</strong></div>
    <div className="admin-page-header reports-header"><div className="admin-page-title-group"><h1>Reports</h1><p>View and manage academic, attendance, behaviour and other school reports.</p></div><div className="admin-header-actions"><label className="context-select"><CalendarDays size={16}/><select aria-label="Academic year" value={draftFilters.academicYearId} onChange={(event) => { const academicYearId = event.target.value; const next = { ...draftFilters, academicYearId, termId: "" }; setDraftFilters(next); setFilters(next); }}><option value="">This Academic Year ({data?.academicYear.name ?? "Unavailable"})</option>{data?.reference.academicYears.filter((year) => year.id !== data.academicYear.id).map((year) => <option value={year.id} key={year.id}>{year.name}</option>)}</select></label><button className="reports-generate-button" onClick={() => setModalType("ACADEMIC")}><Download size={16}/>Generate Report</button></div></div>
    {notice && <div className={`timetable-feedback ${notice.includes("successfully") || notice.includes("downloaded") ? "success" : "error"}`}>{notice}<button onClick={() => setNotice("")}><X size={13}/></button></div>}
    {data && <>
      <div className="reports-kpi-grid"><Kpi icon={<Users/>} label="Total Students" value={data.metrics.totalStudents} trend={data.metrics.trends.totalStudents} tone="blue"/><Kpi icon={<FileText/>} label="Reports Generated" value={data.metrics.reportsGenerated} trend={data.metrics.trends.reportsGenerated} tone="purple"/><Kpi icon={<CalendarDays/>} label="Attendance Rate" value={data.metrics.attendanceRate == null ? "—" : `${data.metrics.attendanceRate}%`} trend={data.metrics.trends.attendanceRate} tone="green"/><Kpi icon={<Sparkles/>} label="Behaviour Incidents" value={data.metrics.behaviourIncidents} trend={data.metrics.trends.behaviourIncidents} tone="amber"/></div>
      <div className="reports-dashboard-grid"><PerformanceChart rows={data.academicPerformance}/><AttendanceChart rows={data.attendanceByYearGroup} overall={data.metrics.attendanceRate}/><section className="reports-panel reports-quick"><h2><Sparkles/>Quick Actions</h2>{quick.map((type) => <button key={type} onClick={() => setModalType(type)}><span style={{ color: reportMeta[type].colour, background: `${reportMeta[type].colour}16` }}>{reportMeta[type].icon}</span><div><strong>{type === "OTHER" ? "Export Data" : `Generate ${reportMeta[type].label}`}</strong><small>{type === "ACADEMIC" ? "Create student performance reports" : type === "ATTENDANCE" ? "View attendance summaries" : type === "BEHAVIOUR" ? "Analyse behaviour records" : "Download reports in various formats"}</small></div><ArrowRight/></button>)}</section>
      <section className="reports-panel recent-reports"><header><div><h2><FileText/>Recent Reports</h2></div><button className="text-button" onClick={() => setDraftFilters(emptyFilters)}>View All <ArrowRight/></button></header><div className="reports-table-wrap"><table><thead><tr><th>Report Name</th><th>Type</th><th>Generated On</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.recentReports.map((report) => <tr key={report.id}><td><div className="report-name-cell"><span style={{ color: reportMeta[report.type].colour, background: `${reportMeta[report.type].colour}16` }}>{reportMeta[report.type].icon}</span><div><strong>{report.name}</strong><small>{reportMeta[report.type].label}</small></div></div></td><td>{reportMeta[report.type].label}</td><td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(report.generatedAt))}</td><td><span className={`report-status ${report.status.toLowerCase()}`}><i/>{report.status === "COMPLETED" ? "Completed" : "Failed"}</span></td><td><div className="report-actions"><button onClick={() => setSelected(report)} title="View report"><Eye/></button><button onClick={() => void download(report)} title="Download CSV"><Download/></button><button onClick={() => setArchiveTarget(report)} title="Archive report"><Archive/></button><MoreVertical/></div></td></tr>)}</tbody></table>{!data.recentReports.length && <div className="reports-empty"><FileBarChart/><strong>No generated reports yet</strong><span>Use Generate Report or a quick action to create the first live report.</span></div>}</div></section>
      <TrendChart rows={data.reportTrends}/><DistributionChart rows={data.reportDistribution}/><aside className="reports-side-column"><section className="reports-panel report-filters"><h2><BarChart3/>Report Filters</h2><label>Report Type<select value={draftFilters.type} onChange={(event) => setDraftFilters({ ...draftFilters, type: event.target.value as ReportType | "" })}><option value="">All Reports</option>{Object.entries(reportMeta).map(([type, meta]) => <option value={type} key={type}>{meta.label}</option>)}</select></label><label>Year Group<select value={draftFilters.yearGroupId} onChange={(event) => setDraftFilters({ ...draftFilters, yearGroupId: event.target.value })}><option value="">All Year Groups</option>{data.reference.yearGroups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Term<select value={draftFilters.termId} onChange={(event) => setDraftFilters({ ...draftFilters, termId: event.target.value })}><option value="">This Academic Year ({selectedYear?.name})</option>{selectedYear?.terms.map((term) => <option value={term.id} key={term.id}>{term.name}</option>)}</select></label><label>Student<select value={draftFilters.studentId} onChange={(event) => setDraftFilters({ ...draftFilters, studentId: event.target.value })}><option value="">Select a student (optional)</option>{data.reference.students.map((student) => <option value={student.id} key={student.id}>{student.firstName} {student.lastName} · {student.admissionNumber}</option>)}</select></label><button onClick={() => setFilters(draftFilters)}><Search/>Apply Filters</button><button className="clear-report-filters" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); }}>Clear filters</button></section></aside></div>
    </>}
    {overview.isLoading && <section className="reports-panel academic-loading">Loading live reports...</section>}
    {overview.isError && <div className="form-error">{overview.error instanceof ApiError ? overview.error.message : "Reports could not be loaded."}</div>}
    {modalType && data && <div className="modal-scrim" onClick={() => setModalType(null)}><form className="modal-dialog reports-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); generate.mutate(modalType); }}><div className="modal-header"><div><h2>Generate {reportMeta[modalType].label}</h2><p>The report will use the active filters and live database records.</p></div><button type="button" className="icon-button" onClick={() => setModalType(null)}><X/></button></div><div className="modal-body timetable-form-grid"><label className="span-two">Report name<input value={reportName} onChange={(event) => setReportName(event.target.value)} placeholder={reportMeta[modalType].label}/></label><div className="report-generation-context span-two"><span><small>Academic year</small><strong>{data.academicYear.name}</strong></span><span><small>Term</small><strong>{data.term?.name ?? "All terms"}</strong></span><span><small>Year group</small><strong>{data.reference.yearGroups.find((group) => group.id === filters.yearGroupId)?.name ?? "All year groups"}</strong></span><span><small>Student</small><strong>{data.reference.students.find((student) => student.id === filters.studentId)?.firstName ?? "All students"}</strong></span></div>{generate.isError && <div className="form-error span-two">{generate.error instanceof ApiError ? generate.error.message : "The report could not be generated."}</div>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setModalType(null)}>Cancel</button><button className="primary-button" disabled={generate.isPending}><FileBarChart/>{generate.isPending ? "Generating..." : "Generate Report"}</button></div></form></div>}
    {selected && <div className="modal-scrim" onClick={() => setSelected(null)}><section className="modal-dialog report-preview-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><h2>{selected.name}</h2><p>{reportMeta[selected.type].label} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(selected.generatedAt))}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X/></button></div><div className="modal-body"><Snapshot value={selected.snapshot}/></div><div className="modal-footer"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button><button className="primary-button" onClick={() => void download(selected)}><Download/>Download CSV</button></div></section></div>}
    {archiveTarget && <div className="modal-scrim" onClick={() => setArchiveTarget(null)}><section className="modal-dialog archive-confirm-dialog" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><h2>Archive report</h2><p>{archiveTarget.name}</p></div><button className="icon-button" onClick={() => setArchiveTarget(null)}><X/></button></div><div className="modal-body"><p>The saved report will be removed from active report lists. Source school records remain unchanged.</p></div><div className="modal-footer"><button className="secondary-button" onClick={() => setArchiveTarget(null)}>Cancel</button><button className="primary-button danger-button" disabled={archive.isPending} onClick={() => archive.mutate()}><Archive/>{archive.isPending ? "Archiving..." : "Archive Report"}</button></div></section></div>}
  </div>;
}
