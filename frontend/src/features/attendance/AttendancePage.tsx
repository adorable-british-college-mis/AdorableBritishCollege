import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileBarChart, Home, MoreVertical, Search, Send, UserX, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, getAttendanceOverview, getAttendanceRegister, openAttendanceRegister, saveAttendanceRegister } from "../../lib/api";
import type { AttendanceCode, AttendanceOverview, AttendanceRegisterDetail, AttendanceRegisterSummary } from "../../types";

const today = new Date().toISOString().slice(0, 10);
const pageSize = 10;
const codes: Array<{ code: AttendanceCode; short: string; label: string; tone: string }> = [
  { code: "PRESENT", short: "P", label: "Present", tone: "green" },
  { code: "LATE", short: "L", label: "Late", tone: "amber" },
  { code: "ABSENT", short: "A", label: "Absent", tone: "red" },
  { code: "AUTHORISED_ABSENCE", short: "AA", label: "Authorised Absence", tone: "blue" },
  { code: "UNAUTHORISED_ABSENCE", short: "UA", label: "Unauthorised Absence", tone: "orange" },
  { code: "MEDICAL", short: "M", label: "Medical", tone: "purple" },
  { code: "OTHER", short: "O", label: "Other", tone: "grey" },
];
const fullName = (student: AttendanceRegisterDetail["students"][number]) => `${student.firstName} ${student.lastName}`;
const className = (register: AttendanceRegisterSummary | AttendanceRegisterDetail) => register.formGroup?.code ?? register.yearGroup.name;
const teacherName = (register: AttendanceRegisterSummary | AttendanceRegisterDetail) => register.teacher ? `${register.teacher.firstName[0]}. ${register.teacher.lastName}` : "Unassigned";
const initials = (value: string) => value.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
const codeMeta = (status: AttendanceCode) => codes.find((item) => item.code === status) ?? codes[6]!;

function AttendanceMetric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string | number; note: string; tone: string }) {
  return <article className="attendance-metric"><span className={`attendance-metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function RegisterTable({ data, open }: { data: AttendanceOverview; open: (register: AttendanceRegisterSummary) => void }) {
  return <section className="attendance-panel registers-panel">
    <header><h2><CalendarDays size={15}/> Today&apos;s Registers</h2><span>{data.registers.length} registers <ArrowRight size={13}/></span></header>
    <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Class</th><th>Teacher</th><th>Period</th><th>Type</th><th>Submitted</th><th>Status</th><th aria-label="Actions"/></tr></thead><tbody>
      {data.registers.map((register) => <tr key={register.timetableSlotId}><td><strong>{className(register)}</strong></td><td><span className="teacher-chip"><i>{initials(teacherName(register))}</i>{teacherName(register)}</span></td><td>{register.periodLabel}</td><td>{register.registerType === "LESSON" ? "Lesson" : register.registerType}</td><td>{register.submittedAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(register.submittedAt)) : "—"}</td><td><button className={`register-status ${register.status.toLowerCase()}`} onClick={() => open(register)}>{register.status === "SUBMITTED" ? "Submitted" : register.records.length ? "In Progress" : "Not Started"}</button></td><td><button className="icon-button" onClick={() => open(register)} aria-label={`Open ${className(register)} register`}><MoreVertical size={15}/></button></td></tr>)}
      {!data.registers.length && <tr><td colSpan={7} className="attendance-empty">No lessons are scheduled today.</td></tr>}
    </tbody></table></div>
  </section>;
}

function ExceptionView({ data, mode }: { data: AttendanceOverview; mode: "Absences" | "Lateness" }) {
  const [search, setSearch] = useState("");
  const records = data.exceptions.filter((record) => {
    const typeMatches = mode === "Lateness" ? record.status === "LATE" : record.status !== "LATE";
    const text = `${record.student.firstName} ${record.student.lastName} ${record.student.admissionNumber} ${record.className} ${record.subject}`.toLowerCase();
    return typeMatches && text.includes(search.toLowerCase());
  });
  return <section className="attendance-panel attendance-record-view">
    <header><div><h2>{mode === "Lateness" ? <Clock3 size={15}/> : <UserX size={15}/>} {mode} Records</h2><small>{records.length} matching records this term</small></div><label className="attendance-search"><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${mode.toLowerCase()}...`}/></label></header>
    <div className="attendance-table-wrap"><table className="attendance-table exception-table"><thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Subject / Period</th><th>Date</th><th>Code</th><th>Notes</th></tr></thead><tbody>
      {records.map((record) => { const meta = codeMeta(record.status); return <tr key={record.id}><td><span className="student-inline"><i>{initials(`${record.student.firstName} ${record.student.lastName}`)}</i><strong>{record.student.firstName} {record.student.lastName}</strong></span></td><td>{record.student.admissionNumber}</td><td>{record.className}</td><td>{record.subject} · {record.periodLabel}</td><td>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(record.date))}</td><td><span className={`exception-code ${meta.tone}`}>{meta.label}</span></td><td>{record.note || "—"}</td></tr>; })}
      {!records.length && <tr><td colSpan={7} className="attendance-empty">No {mode.toLowerCase()} records match this search.</td></tr>}
    </tbody></table></div>
  </section>;
}

function ReportsView({ data }: { data: AttendanceOverview }) {
  const recorded = data.week.filter((item) => item.percentage != null);
  const average = recorded.length ? Math.round(recorded.reduce((sum, item) => sum + (item.percentage ?? 0), 0) / recorded.length * 10) / 10 : null;
  return <div className="attendance-reports"><section className="report-summary-grid">
    <AttendanceMetric icon={<FileBarChart/>} label="Weekly Average" value={average == null ? "—" : `${average}%`} note="Across recorded registers" tone="purple"/>
    <AttendanceMetric icon={<CheckCircle2/>} label="Present Marks" value={data.metrics.present} note="Current school day" tone="green"/>
    <AttendanceMetric icon={<Clock3/>} label="Late Marks" value={data.exceptions.filter((item) => item.status === "LATE").length} note="Current academic term" tone="amber"/>
    <AttendanceMetric icon={<UserX/>} label="Absence Marks" value={data.exceptions.filter((item) => item.status !== "LATE").length} note="Current academic term" tone="red"/>
  </section><section className="attendance-panel report-year-groups"><header><h2><Users size={15}/> Attendance by Year Group</h2><span>Live register data</span></header><div>{data.byYearGroup.map((item) => <article key={item.id}><span>{item.name}</span><b><i style={{width:`${item.percentage ?? 0}%`}}/></b><strong>{item.percentage == null ? "No marks" : `${item.percentage}%`}</strong></article>)}</div></section></div>;
}

function Overview() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["attendance-overview"], queryFn: getAttendanceOverview });
  const [tab, setTab] = useState<"Registers" | "Absences" | "Lateness" | "Reports">("Registers");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const open = useMutation({
    mutationFn: (register: AttendanceRegisterSummary) => register.id ? getAttendanceRegister(register.id) : openAttendanceRegister({ timetableSlotId: register.timetableSlotId, date: today }),
    onSuccess: async (register) => { await client.invalidateQueries({ queryKey: ["attendance-overview"] }); navigate(`/attendance/registers/${register.id}`); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "The register could not be opened."),
  });
  const data = query.data;
  const openRegister = (register: AttendanceRegisterSummary) => { setMenuOpen(false); open.mutate(register); };
  return <div className="admin-page-container attendance-page">
    <div className="breadcrumb-nav"><Home size={14}/><span>Attendance</span><span>/</span><strong>{tab}</strong></div>
    <div className="admin-page-header attendance-header"><div className="admin-page-title-group"><h1>Attendance</h1><p>Track and manage daily registers, absences, and attendance patterns.</p></div><div className="admin-header-actions"><div className="context-select"><CalendarDays size={16}/>Academic Year {data?.academicYear?.name ?? "Not configured"}<ChevronDown size={14}/></div><div className="take-register-menu"><button className="primary-button" disabled={!data?.registers.length || open.isPending} onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}>Take Register <ChevronDown size={14}/></button>{menuOpen && data && <div className="take-register-dropdown"><strong>Choose today&apos;s register</strong>{data.registers.map((register) => <button key={register.timetableSlotId} onClick={() => openRegister(register)}><span><b>{className(register)}</b><small>{register.timetableSlot.subject.name} · {register.periodLabel}</small></span><em>{register.status === "SUBMITTED" ? "Submitted" : register.records.length ? "Continue" : "Start"}</em></button>)}</div>}</div></div></div>
    {query.isLoading && <section className="attendance-panel attendance-loading">Loading attendance records...</section>}
    {query.isError && <div className="form-error">Attendance records could not be loaded.</div>}{error && <div className="form-error">{error}</div>}
    {data && <><div className="attendance-metrics"><AttendanceMetric icon={<CheckCircle2/>} label="Present Today" value={data.metrics.present} note="Live submitted and draft marks" tone="green"/><AttendanceMetric icon={<UserX/>} label="Absent Today" value={data.metrics.absent} note="Across all registers" tone="red"/><AttendanceMetric icon={<Clock3/>} label="Late Arrivals" value={data.metrics.late} note="Recorded today" tone="amber"/><AttendanceMetric icon={<AlertTriangle/>} label="Unauthorised" value={data.metrics.unauthorised} note="Requiring review" tone="orange"/><AttendanceMetric icon={<CalendarDays/>} label="Attendance Rate" value={data.metrics.rate == null ? "—" : `${data.metrics.rate}%`} note="Current school day" tone="purple"/></div>
      <div className="attendance-tabs">{(["Registers","Absences","Lateness","Reports"] as const).map((item) => <button className={tab === item ? "active" : ""} onClick={() => { setTab(item); setMenuOpen(false); }} key={item}>{item}</button>)}</div>
      {tab === "Registers" && <div className="attendance-dashboard-grid"><div className="attendance-main-stack"><RegisterTable data={data} open={openRegister}/><section className="attendance-panel alerts-panel"><header><h2><AlertTriangle size={15}/> Absence Alerts</h2><span>View All <ArrowRight size={13}/></span></header>{data.alerts.map((alert) => <div className="absence-alert" key={alert.id}><span>{initials(alert.name)}</span><div><strong>{alert.name}</strong><small>{alert.yearGroup}</small></div><p>{alert.absences} recorded absences</p><em>Monitor</em></div>)}{!data.alerts.length && <div className="attendance-empty">No persistent absence alerts.</div>}</section></div><aside className="attendance-side-stack"><section className="attendance-panel"><header><h2>Attendance by Year Group</h2></header><div className="year-attendance-list">{data.byYearGroup.map((item) => <div key={item.id} title={`${item.name}: ${item.percentage ?? 0}%`}><span>{item.name}</span><b><i style={{width:`${item.percentage ?? 0}%`}}/></b><strong>{item.percentage == null ? "—" : `${item.percentage}%`}</strong></div>)}</div></section><section className="attendance-panel quick-register"><header><h2>Quick Actions</h2></header>{data.registers.slice(0,4).map((register) => <button key={register.timetableSlotId} onClick={() => openRegister(register)}><Clock3 size={15}/><span><strong>Take {className(register)} Register</strong><small>{register.periodLabel} · {register.timetableSlot.subject.name}</small></span><ArrowRight size={14}/></button>)}</section></aside></div>}
      {tab === "Absences" && <ExceptionView data={data} mode="Absences"/>}{tab === "Lateness" && <ExceptionView data={data} mode="Lateness"/>}{tab === "Reports" && <ReportsView data={data}/>}</>}
  </div>;
}

function Register({ id }: { id: string }) {
  const navigate = useNavigate(); const client = useQueryClient();
  const query = useQuery({ queryKey: ["attendance-register", id], queryFn: () => getAttendanceRegister(id) });
  const [marks, setMarks] = useState<Record<string,{status:AttendanceCode;note:string}>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = useState<AttendanceCode>("PRESENT");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [message, setMessage] = useState(""); const data = query.data;
  const values = useMemo(() => data?.students.map((student) => ({ studentId: student.id, status: marks[student.id]?.status ?? student.attendance?.status, note: marks[student.id]?.note ?? student.attendance?.note ?? "" })).filter((item): item is {studentId:string;status:AttendanceCode;note:string} => Boolean(item.status)) ?? [], [data,marks]);
  const save = useMutation({ mutationFn: (submit:boolean) => saveAttendanceRegister(id,values,submit), onSuccess: async (_result,submit) => { setMessage(submit ? "Register submitted and locked successfully." : "Draft saved successfully."); await Promise.all([client.invalidateQueries({queryKey:["attendance-overview"]}),client.invalidateQueries({queryKey:["dashboard-summary"]}),client.invalidateQueries({queryKey:["attendance-register",id]})]); if(submit) navigate("/attendance"); else {setMarks({});setSelected(new Set());}}, onError:(reason)=>setMessage(reason instanceof ApiError?reason.message:"The register could not be saved.") });
  const setStudents = (ids:string[],status:AttendanceCode) => { if(!data || data.status === "SUBMITTED") return; setMarks((existing)=>{const next={...existing}; ids.forEach((studentId)=>{const student=data.students.find((item)=>item.id===studentId)!;next[studentId]={status,note:existing[studentId]?.note ?? student.attendance?.note ?? ""};});return next;});};
  const marked=values.length,total=data?.students.length??0;
  const filtered=data?.students.filter((student)=>fullName(student).toLowerCase().includes(search.toLowerCase())||student.admissionNumber.toLowerCase().includes(search.toLowerCase()))??[];
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,totalPages),pageStudents=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const allPageSelected=pageStudents.length>0&&pageStudents.every((student)=>selected.has(student.id));
  const togglePage=()=>setSelected((existing)=>{const next=new Set(existing);pageStudents.forEach((student)=>allPageSelected?next.delete(student.id):next.add(student.id));return next;});
  if(query.isLoading)return <div className="admin-page-container attendance-page"><section className="attendance-panel attendance-loading">Opening register...</section></div>;
  if(!data)return <div className="admin-page-container attendance-page"><div className="form-error">Register unavailable.</div></div>;
  return <div className="admin-page-container attendance-page register-page">
    <div className="breadcrumb-nav"><span>Attendance</span><span>/</span><span>Registers</span><span>/</span><strong>Take Register</strong></div>
    <div className="admin-page-header attendance-header"><div className="admin-page-title-group"><h1>Take Register</h1><p>Mark attendance for your class. All entries are timestamped and audit-logged.</p></div><div className="admin-header-actions"><button className="secondary-button" onClick={()=>navigate("/attendance")}><X size={15}/> Cancel</button><button className="primary-button" disabled={marked!==total||save.isPending||data.status==="SUBMITTED"} onClick={()=>save.mutate(true)}><Check size={15}/> Submit Register</button></div></div>
    <section className="attendance-panel register-context"><div><small>Class</small><strong>{className(data)}</strong></div><div><small>Subject</small><strong>{data.timetableSlot.subject.name}</strong></div><div><small>Teacher</small><strong>{teacherName(data)}</strong></div><div><small>Room</small><strong>{data.timetableSlot.room??"TBC"}</strong></div><div><small>Period</small><strong>{data.periodLabel}</strong></div><div><small>Date</small><strong>{new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(data.date))}</strong></div><div className="live-time"><i/> Live<strong>{new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date())}</strong></div></section>
    {message&&<div className={`timetable-feedback ${message.includes("successfully")?"success":"error"}`}>{message}<button onClick={()=>setMessage("")}><X size={13}/></button></div>}
    <div className="register-layout"><section className="attendance-panel register-sheet"><header><div><h2>Class Register — {className(data)}</h2><small>{total} {total===1?"Student":"Students"} · {selected.size} selected</small></div><div className="register-tools"><button className="mark-all-present" onClick={()=>setStudents(data.students.map((student)=>student.id),"PRESENT")}><Check size={13}/> Mark All Present</button><button className="mark-all-absent" onClick={()=>setStudents(data.students.map((student)=>student.id),"ABSENT")}>Mark All Absent</button><label><Search size={14}/><input value={search} onChange={(event)=>{setSearch(event.target.value);setPage(1);}} placeholder="Filter students..."/></label></div></header>
      {selected.size>0&&<div className="bulk-attendance-bar"><strong>{selected.size} selected</strong><span>Set code:</span><select value={bulkCode} onChange={(event)=>setBulkCode(event.target.value as AttendanceCode)}>{codes.map((item)=><option value={item.code} key={item.code}>{item.short} · {item.label}</option>)}</select><button onClick={()=>{setStudents([...selected],bulkCode);setSelected(new Set());}}>Apply to selected</button><button className="clear-selection" onClick={()=>setSelected(new Set())}>Clear</button></div>}
      <div className="register-table-wrap"><table className="register-table"><thead><tr><th><input type="checkbox" aria-label="Select all students on this page" disabled={data.status==="SUBMITTED"} checked={allPageSelected} onChange={togglePage}/></th><th>#</th><th>Student</th><th>Admission No.</th><th>Attendance Code</th><th>Notes</th><th>Time Marked</th></tr></thead><tbody>{pageStudents.map((student,index)=>{const current=marks[student.id]?.status??student.attendance?.status;return <tr key={student.id} className={selected.has(student.id)?"selected-row":""}><td><input type="checkbox" aria-label={`Select ${fullName(student)}`} disabled={data.status==="SUBMITTED"} checked={selected.has(student.id)} onChange={()=>setSelected((existing)=>{const next=new Set(existing);if(next.has(student.id))next.delete(student.id);else next.add(student.id);return next;})}/></td><td>{(currentPage-1)*pageSize+index+1}</td><td><span className="register-student"><i>{initials(fullName(student))}</i><span><strong>{fullName(student)}</strong><small>{student.enrollments[0]?.yearGroup.name}</small></span></span></td><td>{student.admissionNumber}</td><td><div className="attendance-code-buttons">{codes.map((item)=><button title={item.label} disabled={data.status==="SUBMITTED"} className={`${item.tone} ${current===item.code?"selected":""}`} onClick={()=>setStudents([student.id],item.code)} key={item.code}>{item.short}</button>)}</div></td><td><input aria-label={`Note for ${fullName(student)}`} disabled={data.status==="SUBMITTED"} value={marks[student.id]?.note??student.attendance?.note??""} onChange={(event)=>setMarks((existing)=>({...existing,[student.id]:{status:existing[student.id]?.status??student.attendance?.status??"PRESENT",note:event.target.value}}))} placeholder="Add note..."/></td><td>{current?new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date()):"—"}</td></tr>;})}</tbody></table></div>
      <footer className="register-pagination"><span>Showing {filtered.length?(currentPage-1)*pageSize+1:0}–{Math.min(currentPage*pageSize,filtered.length)} of {filtered.length} students</span><div><button aria-label="Previous page" disabled={currentPage===1} onClick={()=>setPage((value)=>Math.max(1,value-1))}><ChevronLeft size={14}/></button>{Array.from({length:totalPages},(_,index)=>index+1).slice(Math.max(0,currentPage-3),currentPage+2).map((number)=><button className={number===currentPage?"active":""} onClick={()=>setPage(number)} key={number}>{number}</button>)}<button aria-label="Next page" disabled={currentPage===totalPages} onClick={()=>setPage((value)=>Math.min(totalPages,value+1))}><ChevronRight size={14}/></button></div></footer>
    </section><aside className="register-side"><section className="attendance-panel progress-card"><h2>Progress</h2><div className="progress-ring" style={{"--progress":`${total?marked/total*360:0}deg`} as React.CSSProperties}><span><strong>{total?Math.round(marked/total*100):0}%</strong><small>{marked} of {total} marked</small></span></div><p>{total-marked?<><AlertTriangle size={13}/>{total-marked} student{total-marked===1?"":"s"} unmarked</>:<><CheckCircle2 size={13}/>All students marked</>}</p><div className="progress-legend">{codes.slice(0,6).map((item)=><span key={item.code}><i className={item.tone}/>{item.label}<b>{values.filter((value)=>value.status===item.code).length}</b></span>)}</div></section><section className="attendance-panel code-reference"><h2>Code Reference</h2>{codes.map((item)=><span key={item.code}><i className={item.tone}>{item.short}</i>{item.label}</span>)}</section></aside></div>
    <footer className="register-save-bar"><p><AlertTriangle size={14}/>{data.status==="SUBMITTED"?"This register is submitted and locked.":`${total-marked} student${total-marked===1?"":"s"} remain unmarked.`}</p><div><button className="secondary-button" disabled={save.isPending||data.status==="SUBMITTED"} onClick={()=>save.mutate(false)}>Save Draft</button><button className="primary-button" disabled={marked!==total||save.isPending||data.status==="SUBMITTED"} onClick={()=>save.mutate(true)}><Send size={14}/> Submit Register</button></div></footer>
  </div>;
}

function TakeRegisterRoute() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const started = useRef(false);
  const overview = useQuery({ queryKey: ["attendance-overview"], queryFn: getAttendanceOverview });
  const open = useMutation({
    mutationFn: (register: AttendanceRegisterSummary) => register.id
      ? getAttendanceRegister(register.id)
      : openAttendanceRegister({ timetableSlotId: register.timetableSlotId, date: today }),
    onSuccess: async (register) => {
      await client.invalidateQueries({ queryKey: ["attendance-overview"] });
      navigate(`/attendance/registers/${register.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (!overview.data || started.current) return;
    const register = overview.data.registers.find((item) => item.status !== "SUBMITTED") ?? overview.data.registers[0];
    if (!register) return;
    started.current = true;
    open.mutate(register);
  }, [overview.data, open]);

  const noRegisters = overview.data && overview.data.registers.length === 0;
  return <div className="admin-page-container attendance-page">
    <div className="breadcrumb-nav"><Home size={14}/><span>Attendance</span><span>/</span><strong>Take Register</strong></div>
    <div className="admin-page-header attendance-header"><div className="admin-page-title-group"><h1>Take Register</h1><p>Opening today&apos;s next live class register.</p></div></div>
    <section className="attendance-panel attendance-loading">
      {overview.isError || open.isError ? "The live register could not be opened." : noRegisters ? "No classes are scheduled for today." : "Preparing the class register..."}
    </section>
  </div>;
}

export function AttendancePage(){const {registerId}=useParams();const location=useLocation();if(registerId)return <Register id={registerId}/>;if(location.pathname==="/attendance/take-register")return <TakeRegisterRoute/>;return <Overview/>;}
