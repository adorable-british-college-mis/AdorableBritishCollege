import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  Home,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Table2,
  X,
} from "lucide-react";
import { Fragment, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  createCoverArrangement,
  createTimetableLesson,
  getTimetableOverview,
  updateTimetableLesson,
} from "../../lib/api";
import type { TimetableOverview, TimetableSlot } from "../../types";

type ViewMode = "overview" | "class" | "teacher";
type ModalMode = "lesson" | "cover";
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const colours = ["lavender", "blue", "green", "amber", "pink", "teal"];
const today = new Date().toISOString().slice(0, 10);

function teacherName(slot: TimetableSlot) {
  return slot.staff
    ? `${slot.staff.firstName[0]}. ${slot.staff.lastName}`
    : "Unassigned";
}
function className(slot: TimetableSlot) {
  return slot.formGroup?.code ?? slot.yearGroup.name;
}

function Metric({
  tone,
  icon,
  label,
  value,
  note,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="timetable-metric">
      <span className={`timetable-metric-icon ${tone}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function LessonCard({
  slot,
  conflict,
  onEdit,
  onDragStart,
}: {
  slot: TimetableSlot;
  conflict?: boolean;
  onEdit: () => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
}) {
  const tone =
    colours[
      Math.abs(
        slot.subject.code
          .split("")
          .reduce((sum, char) => sum + char.charCodeAt(0), 0),
      ) % colours.length
    ];
  return (
    <article
      className={`lesson-card ${tone} ${conflict ? "conflict" : ""}`}
      draggable
      tabIndex={0}
      role="button"
      title={`${slot.subject.name}, ${className(slot)}, ${teacherName(slot)}. Click to edit or drag to move.`}
      onClick={onEdit}
      onDragStart={onDragStart}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
    >
      <GripVertical className="lesson-drag-handle" size={13} />
      <div>
        <strong>{slot.subject.name}</strong>
        <b>{className(slot)}</b>
      </div>
      <span>{teacherName(slot)}</span>
      <small>
        <Building2 size={10} />
        {slot.room ?? "Room TBC"}
      </small>
      {conflict && <em>Conflict</em>}
      <span className="lesson-hover-action">
        <Pencil size={11} /> Edit
      </span>
    </article>
  );
}

function TimetableModal({
  mode,
  data,
  editSlot,
  onClose,
}: {
  mode: ModalMode;
  data: TimetableOverview;
  editSlot?: TimetableSlot | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [yearGroupId, setYearGroupId] = useState(editSlot?.yearGroupId ?? "");
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState("");
  const selectedSlot = data.slots.find((slot) => slot.id === slotId);
  const forms = data.reference.formGroups.filter(
    (group) => group.yearGroupId === yearGroupId,
  );
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      mode === "lesson"
        ? (editSlot
            ? updateTimetableLesson
            : (
                _id: string,
                input: Parameters<typeof createTimetableLesson>[0],
              ) => createTimetableLesson(input))(editSlot?.id ?? "", {
            termId: String(form.get("termId")),
            yearGroupId: String(form.get("yearGroupId")),
            formGroupId: String(form.get("formGroupId")),
            subjectId: String(form.get("subjectId")),
            staffId: String(form.get("staffId")),
            weekday: Number(form.get("weekday")),
            startsAt: String(form.get("startsAt")),
            endsAt: String(form.get("endsAt")),
            periodLabel: String(form.get("periodLabel")),
            room: String(form.get("room")),
          })
        : createCoverArrangement({
            timetableSlotId: String(form.get("timetableSlotId")),
            absentStaffId: selectedSlot?.staff?.id ?? "",
            coverStaffId: String(form.get("coverStaffId")),
            date: String(form.get("date")),
            status: String(form.get("status")) as "PENDING" | "CONFIRMED",
            note: String(form.get("note")),
          }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["timetable-overview"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? `${reason.message}${Array.isArray(reason.details) ? ` ${reason.details.join(" ")}` : ""}`
          : "The timetable record could not be saved.",
      ),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    mutation.mutate(new FormData(event.currentTarget));
  }
  return (
    <div className="modal-scrim timetable-modal-scrim" onClick={onClose}>
      <form
        className="modal-dialog timetable-form-modal"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>
              {mode === "lesson"
                ? editSlot
                  ? "Edit Lesson"
                  : "New Lesson"
                : "Cover Arrangement"}
            </h2>
            <p>{data.currentTerm?.name ?? "Current term"} timetable</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body timetable-form-grid">
          {mode === "lesson" ? (
            <>
              <label>
                Term *
                <select
                  name="termId"
                  required
                  defaultValue={editSlot?.termId ?? data.currentTerm?.id}
                >
                  {data.academicYear?.terms?.map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year group *
                <select
                  name="yearGroupId"
                  required
                  value={yearGroupId}
                  onChange={(event) => setYearGroupId(event.target.value)}
                >
                  <option value="">Select year group</option>
                  {data.reference.yearGroups.map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Class / Form
                <select
                  name="formGroupId"
                  defaultValue={editSlot?.formGroupId ?? ""}
                  disabled={!yearGroupId}
                >
                  <option value="">Whole year group</option>
                  {forms.map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject *
                <select
                  name="subjectId"
                  required
                  defaultValue={editSlot?.subjectId ?? ""}
                >
                  <option value="">Select subject</option>
                  {data.reference.subjects.map((subject) => (
                    <option value={subject.id} key={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Teacher
                <select name="staffId" defaultValue={editSlot?.staffId ?? ""}>
                  <option value="">Unassigned</option>
                  {data.reference.staff.map((staff) => (
                    <option value={staff.id} key={staff.id}>
                      {staff.firstName} {staff.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Day *
                <select
                  name="weekday"
                  required
                  defaultValue={String(editSlot?.weekday ?? 1)}
                >
                  {weekdays.map((day, index) => (
                    <option value={index + 1} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Period label *
                <input
                  name="periodLabel"
                  required
                  defaultValue={editSlot?.periodLabel}
                  placeholder="e.g. Period 1"
                />
              </label>
              <label>
                Room
                <input
                  name="room"
                  placeholder="e.g. Room 14"
                  defaultValue={editSlot?.room}
                />
              </label>
              <label>
                Start time *
                <input
                  name="startsAt"
                  type="time"
                  required
                  defaultValue={editSlot?.startsAt}
                />
              </label>
              <label>
                End time *
                <input
                  name="endsAt"
                  type="time"
                  required
                  defaultValue={editSlot?.endsAt}
                />
              </label>
            </>
          ) : (
            <>
              <label className="span-two">
                Lesson *
                <select
                  name="timetableSlotId"
                  required
                  value={slotId}
                  onChange={(event) => setSlotId(event.target.value)}
                >
                  <option value="">Select lesson</option>
                  {data.slots
                    .filter((slot) => slot.staff)
                    .map((slot) => (
                      <option value={slot.id} key={slot.id}>
                        {weekdays[slot.weekday - 1]} · {slot.periodLabel} ·{" "}
                        {slot.subject.name} · {className(slot)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Absent teacher
                <input
                  readOnly
                  value={
                    selectedSlot?.staff
                      ? `${selectedSlot.staff.firstName} ${selectedSlot.staff.lastName}`
                      : "Select a lesson"
                  }
                />
              </label>
              <label>
                Cover teacher
                <select name="coverStaffId" defaultValue="">
                  <option value="">Cover unassigned</option>
                  {data.reference.staff
                    .filter((staff) => staff.id !== selectedSlot?.staff?.id)
                    .map((staff) => (
                      <option value={staff.id} key={staff.id}>
                        {staff.firstName} {staff.lastName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Date *
                <input name="date" type="date" required defaultValue={today} />
              </label>
              <label>
                Status *
                <select name="status" defaultValue="PENDING">
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                </select>
              </label>
              <label className="span-two">
                Cover note
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Reason and handover information"
                />
              </label>
            </>
          )}
          {error && (
            <div className="form-error span-two" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Saving..."
              : mode === "lesson"
                ? editSlot
                  ? "Save Lesson Changes"
                  : "Create Lesson"
                : "Save Cover"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TimetablePage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["timetable-overview"],
    queryFn: getTimetableOverview,
  });
  const [view, setView] = useState<ViewMode>("overview");
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [editSlot, setEditSlot] = useState<TimetableSlot | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState("");
  const data = query.data;
  const firstScheduledFormId = data?.slots.find((slot) => slot.formGroupId)?.formGroupId;
  const selectedForm = data?.reference.formGroups.find((item) => item.id === filter) ?? (view === "class" ? data?.reference.formGroups.find((item) => item.id === firstScheduledFormId) ?? data?.reference.formGroups[0] : undefined);
  const selectedTeacher = data?.reference.staff.find((item) => item.id === filter) ?? (view === "teacher" ? data?.reference.staff[0] : undefined);
  const effectiveFilter = filter || (view === "class" ? selectedForm?.id : view === "teacher" ? selectedTeacher?.id : "") || "";
  const moveLesson = useMutation({
    mutationFn: ({
      slot,
      weekday,
      period,
    }: {
      slot: TimetableSlot;
      weekday: number;
      period: TimetableOverview["periods"][number];
    }) =>
      updateTimetableLesson(slot.id, {
        termId: slot.termId,
        yearGroupId: slot.yearGroupId,
        formGroupId: slot.formGroupId ?? "",
        subjectId: slot.subjectId,
        staffId: slot.staffId ?? "",
        weekday,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        periodLabel: period.label,
        room: slot.room ?? "",
      }),
    onSuccess: async () => {
      setInteractionMessage("Lesson moved successfully.");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["timetable-overview"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
    onError: (reason) =>
      setInteractionMessage(
        reason instanceof ApiError
          ? `${reason.message}${Array.isArray(reason.details) ? ` ${reason.details.join(" ")}` : ""}`
          : "The lesson could not be moved.",
      ),
    onSettled: () => setDraggingId(null),
  });
  const slots = useMemo(
    () =>
      data?.slots.filter((slot) =>
        view === "class" && filter
          ? slot.formGroupId === effectiveFilter
          : view === "teacher" && effectiveFilter
            ? slot.staffId === effectiveFilter
            : true,
      ) ?? [],
    [data, view, filter, effectiveFilter],
  );
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    slots.forEach((slot, index) =>
      slots.slice(index + 1).forEach((other) => {
        if (
          slot.weekday === other.weekday &&
          slot.startsAt < other.endsAt &&
          other.startsAt < slot.endsAt &&
          ((slot.room &&
            other.room &&
            slot.room.toLowerCase() === other.room.toLowerCase()) ||
            (slot.staffId && slot.staffId === other.staffId) ||
            (slot.formGroupId && slot.formGroupId === other.formGroupId))
        ) {
          ids.add(slot.id);
          ids.add(other.id);
        }
      }),
    );
    return ids;
  }, [slots]);
  return (
    <div className="admin-page-container timetable-page">
      <div className="breadcrumb-nav">
        <Home size={14} />
        <span>Home</span>
        <span>/</span>
        <span>Timetable</span>
        <span>/</span>
        <strong>Overview</strong>
      </div>
      <div className="admin-page-header timetable-header">
        <div className="admin-page-title-group">
          <h1>Timetable</h1>
          <p>Manage and view class schedules, rooms, and cover arrangements.</p>
        </div>
        <div className="admin-header-actions">
          <div className="context-select">
            <CalendarDays size={16} />
            Academic Year {data?.academicYear?.name ?? "Not configured"}
            <ChevronDown size={14} />
          </div>
          <button className="primary-button" onClick={() => setModal("lesson")}>
            <Plus size={17} /> New Lesson <ChevronDown size={14} />
          </button>
        </div>
      </div>
      {query.isLoading && (
        <section className="timetable-panel timetable-loading">
          Loading timetable...
        </section>
      )}
      {query.isError && (
        <div className="form-error">
          {query.error instanceof ApiError
            ? query.error.message
            : "The timetable could not be loaded."}
        </div>
      )}
      {data && (
        <>
          {view === "overview" && <div className="timetable-metrics">
            <Metric
              tone="purple"
              icon={<Table2 />}
              label="Total Classes"
              value={data.metrics.totalClasses}
              note="Scheduled this term"
            />
            <Metric
              tone="blue"
              icon={<Building2 />}
              label="Rooms Assigned"
              value={data.metrics.roomsAssigned}
              note="Distinct teaching rooms"
            />
            <Metric
              tone="green"
              icon={<RefreshCw />}
              label="Cover Lessons Today"
              value={data.metrics.coverLessonsToday}
              note="Live cover records"
            />
            <Metric
              tone="red"
              icon={<AlertTriangle />}
              label="Timetable Conflicts"
              value={data.metrics.conflicts}
              note={
                data.metrics.conflicts
                  ? "Require attention"
                  : "No clashes detected"
              }
            />
          </div>}
          <section className="timetable-tabs">
            <button
              className={view === "overview" ? "active" : ""}
              onClick={() => {
                setView("overview");
                setFilter("");
              }}
            >
              Overview
            </button>
            <button
              className={view === "class" ? "active" : ""}
              onClick={() => {
                setView("class");
                setFilter(firstScheduledFormId ?? data.reference.formGroups[0]?.id ?? "");
              }}
            >
              By Class
            </button>
            <button
              className={view === "teacher" ? "active" : ""}
              onClick={() => {
                setView("teacher");
                setFilter(data.reference.staff[0]?.id ?? "");
              }}
            >
              By Teacher
            </button>
          </section>
          {view !== "overview" && (
            <div className="timetable-filter-row timetable-advanced-filters">
              <label>
                <select
                  aria-label={view === "class" ? "Class" : "Teacher"}
                  value={effectiveFilter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {(view === "class"
                    ? data.reference.formGroups
                    : data.reference.staff
                  ).map((item) => (
                    <option value={item.id} key={item.id}>
                      {"code" in item
                        ? `${item.code} · ${item.name}`
                        : `${item.firstName} ${item.lastName}`}
                    </option>
                  ))}
                </select>
              </label>
              <label><select aria-label="Subject"><option>All Subjects</option>{data.reference.subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select></label>
              {view === "class" && <label><select aria-label="Teacher filter"><option>All Teachers</option>{data.reference.staff.map((staff) => <option key={staff.id}>{staff.firstName} {staff.lastName}</option>)}</select></label>}
              <label><select aria-label="Term"><option>{data.currentTerm?.name ?? "Current Term"} {data.academicYear?.name}</option></select></label>
              <button className="primary-button">Apply Filters</button>
            </div>
          )}
          {view === "class" && selectedForm && <section className="timetable-context-card">
            <div><small>Class Code</small><strong>{selectedForm.code}</strong></div><div><small>Year Group</small><strong>{selectedForm.yearGroup.name}</strong></div><div><small>Form Tutor</small><strong>{data.slots.find((slot) => slot.formGroupId === selectedForm.id)?.staff ? teacherName(data.slots.find((slot) => slot.formGroupId === selectedForm.id)!) : "Unassigned"}</strong></div><div><small>No. of Students</small><strong>{data.slots.filter((slot) => slot.formGroupId === selectedForm.id).length ? "Live enrolment" : "0 students"}</strong></div><div><small>Head of Year</small><strong>Academic leadership</strong></div><div><small>Academic Pathway</small><strong>British Curriculum</strong></div>
          </section>}
          {view === "teacher" && selectedTeacher && <section className="timetable-context-card teacher-context-card"><div className="teacher-profile"><i>{selectedTeacher.firstName[0]}{selectedTeacher.lastName[0]}</i><span><strong>Mr./Ms. {selectedTeacher.firstName} {selectedTeacher.lastName}</strong><small>Staff ID: {selectedTeacher.staffNumber} · {selectedTeacher.jobTitle}</small></span></div><div className="teacher-stats"><span><strong>{new Set(slots.map((slot) => slot.formGroupId)).size}</strong><small>Classes Assigned</small></span><span><strong>{slots.length}</strong><small>Periods This Week</small></span><span><strong>{data.covers.filter((cover) => cover.coverStaff?.id === selectedTeacher.id).length}</strong><small>Cover Duties</small></span></div></section>}
          <div className="timetable-interaction-note">
            <GripVertical size={15} /> Drag a lesson to another day or period,
            or click it to edit every detail.
          </div>
          {interactionMessage && (
            <div
              className={`timetable-feedback ${interactionMessage.includes("successfully") ? "success" : "error"}`}
              role="status"
            >
              {interactionMessage}
              <button
                onClick={() => setInteractionMessage("")}
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="timetable-workspace">
            <section className="timetable-panel weekly-timetable">
              <header>
                <h2>
                  <CalendarDays size={16} /> Weekly Timetable
                </h2>
                <span>
                  View Full Timetable <ArrowRight size={13} />
                </span>
              </header>
              <div className="weekly-grid-scroll">
                <div className="weekly-grid">
                  <div className="weekly-grid-head period-head">Period</div>
                  {weekdays.map((day) => (
                    <div className="weekly-grid-head" key={day}>
                      {day}
                    </div>
                  ))}
                  {data.periods.map((period) => (
                    <Fragment key={`${period.startsAt}-${period.endsAt}`}>
                    <div
                      className="weekly-grid-row"
                    >
                      <div className="period-cell">
                        <strong>{period.label}</strong>
                        <small>
                          {period.startsAt}–{period.endsAt}
                        </small>
                      </div>
                      {weekdays.map((day, dayIndex) => {
                        const matches = slots.filter(
                          (slot) =>
                            slot.weekday === dayIndex + 1 &&
                            slot.startsAt === period.startsAt,
                        );
                        return (
                          <div
                            className={`lesson-cell ${draggingId ? "drop-ready" : ""}`}
                            key={day}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const id =
                                event.dataTransfer.getData("text/plain") ||
                                draggingId;
                              const slot = data.slots.find(
                                (item) => item.id === id,
                              );
                              if (
                                !slot ||
                                (slot.weekday === dayIndex + 1 &&
                                  slot.startsAt === period.startsAt)
                              ) {
                                setDraggingId(null);
                                return;
                              }
                              setInteractionMessage("");
                              moveLesson.mutate({
                                slot,
                                weekday: dayIndex + 1,
                                period,
                              });
                            }}
                          >
                            {matches.slice(0, 1).map((slot) => (
                              <LessonCard
                                slot={slot}
                                conflict={conflictIds.has(slot.id)}
                                onEdit={() => {
                                  setEditSlot(slot);
                                  setModal("lesson");
                                }}
                                onDragStart={(event) => {
                                  setDraggingId(slot.id);
                                  event.dataTransfer.setData(
                                    "text/plain",
                                    slot.id,
                                  );
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                                key={slot.id}
                              />
                            ))}
                            {matches.length > 1 && (
                              <span className="more-lessons">
                                +{matches.length - 1} more
                              </span>
                            )}
                            {!matches.length && view === "teacher" && <span className="teacher-availability">{(dayIndex + Number(period.label.replace(/\D/g, ""))) % 4 === 0 ? "PPA" : "Free"}</span>}
                          </div>
                        );
                      })}
                    </div>
                    {period.label === "Period 2" && <div className="weekly-break-row">Break · 10:30–11:00</div>}
                    {period.label === "Period 4" && <div className="weekly-break-row">Lunch · 13:00–13:45</div>}
                    </Fragment>
                  ))}
                </div>
                {!data.periods.length && (
                  <div className="timetable-empty">
                    No lessons have been scheduled for this term. Use New Lesson
                    to begin.
                  </div>
                )}
              </div>
            </section>
            <aside className="timetable-side">
              {view === "teacher" && selectedTeacher && <section className="timetable-panel teaching-load"><h2>Teaching Load</h2>{[...new Map(slots.map((slot) => [className(slot), slots.filter((item) => className(item) === className(slot)).length])).entries()].map(([name,count]) => <div className="teaching-load-row" key={name}><span>{name} {slots.find((slot) => className(slot) === name)?.subject.name}</span><span>{count} periods</span><b><i style={{width:`${Math.min(100,count * 20)}%`}}/></b></div>)}</section>}
              <section className="timetable-panel today-schedule">
                <header>
                  <h2>
                    <CalendarDays size={16} /> Today&apos;s Schedule
                  </h2>
                </header>
                <p>
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date())}
                </p>
                {data.todaySchedule.map((slot, index) => (
                  <div
                    className="today-lesson"
                    key={slot.id}
                    style={{
                      borderColor: ["#477ce0", "#8752d7", "#35a36f", "#eca52c"][
                        index % 4
                      ],
                    }}
                  >
                    <strong>
                      {slot.periodLabel} · {slot.subject.name}
                    </strong>
                    <span>
                      {className(slot)} · {teacherName(slot)}
                    </span>
                    <small>{slot.room ?? "Room TBC"}</small>
                  </div>
                ))}
                {!data.todaySchedule.length && (
                  <div className="side-empty">No lessons scheduled today.</div>
                )}
              </section>
              <section className="timetable-panel cover-panel">
                <header>
                  <h2>
                    <RefreshCw size={16} /> Cover Arrangements
                  </h2>
                  <button onClick={() => setModal("cover")}>
                    <Plus size={14} /> Add
                  </button>
                </header>
                {data.covers.map((cover) => (
                  <div className="cover-row" key={cover.id}>
                    <div>
                      <strong>
                        {cover.timetableSlot.periodLabel} ·{" "}
                        {cover.timetableSlot.subject.name}{" "}
                        {className(cover.timetableSlot)}
                      </strong>
                      <span>
                        Absent: {cover.absentStaff.firstName[0]}.{" "}
                        {cover.absentStaff.lastName} · Cover:{" "}
                        {cover.coverStaff
                          ? `${cover.coverStaff.firstName[0]}. ${cover.coverStaff.lastName}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <em className={cover.status.toLowerCase()}>
                      {cover.status === "PENDING" ? "Pending" : "Confirmed"}
                    </em>
                  </div>
                ))}
                {!data.covers.length && (
                  <div className="side-empty">
                    No upcoming cover arrangements.
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
      {modal && data && (
        <TimetableModal
          mode={modal}
          data={data}
          editSlot={modal === "lesson" ? editSlot : null}
          onClose={() => {
            setModal(null);
            setEditSlot(null);
          }}
        />
      )}
    </div>
  );
}
