import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive, ArrowRight, Bot, CalendarDays, Check, ChevronDown, Edit3, Home, Mail,
  Megaphone, MessageCircle, MessageSquare, Paperclip, Phone, Plus,
  Search, Send, Sparkles, Users, Video, X,
} from "lucide-react";
import { Fragment, useMemo, useState, type FormEvent } from "react";
import {
  ApiError, archiveAnnouncement, archiveCommunicationThread, createAnnouncement,
  createCommunicationThread, draftCommunicationWithAssistant, getCommunicationOverview,
  markCommunicationThreadRead, sendCommunicationMessage, updateAnnouncement,
} from "../../lib/api";
import type { Announcement, CommunicationOverview, CommunicationRecipientType, CommunicationThread } from "../../types";
import { useAuth } from "../auth/auth-context";

type TabName = "inbox" | "sent" | "announcements" | "drafts";
const TAB_LABELS: Record<TabName, string> = { inbox: "Inbox", sent: "Sent", announcements: "Announcements", drafts: "Drafts" };
type ComposeMode = "message" | "group" | "email" | "whatsapp" | "announcement";
type Recipient = { key: string; type: CommunicationRecipientType; id: string; name: string; role: string; email?: string | null; phone?: string | null };
type LiveEvent = CommunicationOverview["liveEvents"][number];
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const ago = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
};
const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

function ActionCard({ icon, title, note, tone, onClick }: { icon: React.ReactNode; title: string; note: string; tone: string; onClick: () => void }) {
  return <button className="communication-action-card" onClick={onClick}><span className={tone}>{icon}</span><div><strong>{title}</strong><small>{note}</small></div><ArrowRight /></button>;
}

function EmailPreview({
  subject,
  body,
  recipientName,
  mobile,
}: {
  subject: string;
  body: string;
  recipientName: string;
  mobile: boolean;
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div
      className={`abc-email-preview ${mobile ? "mobile" : "desktop"
        }`}
    >
      <div className="abc-email-card">
        <header className="abc-email-header">
          <div className="abc-email-brand-mark">
            <span>ABC</span>
          </div>

          <div className="abc-email-brand">
            <h2>Adorable British College</h2>
            <p>Official School Communication</p>
          </div>
        </header>

        <main className="abc-email-content">
          <span className="abc-email-category">
            School Communication
          </span>

          <h1>{subject.trim() || "Your email subject"}</h1>

          <div className="abc-email-divider" />

          <p className="abc-email-greeting">
            Dear {recipientName},
          </p>

          <div className="abc-email-message">
            {paragraphs.length ? (
              paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${paragraph}-${paragraphIndex}`}>
                  {paragraph.split("\n").map((line, lineIndex) => (
                    <Fragment key={`${line}-${lineIndex}`}>
                      {line}
                      {lineIndex <
                        paragraph.split("\n").length - 1 && <br />}
                    </Fragment>
                  ))}
                </p>
              ))
            ) : (
              <p className="abc-email-placeholder">
                Your message will appear here as you type...
              </p>
            )}
          </div>

          <div className="abc-email-help">
            <span className="abc-email-help-icon">i</span>

            <div>
              <strong>Need assistance?</strong>

              <p>
                Please contact the school office if you have any
                questions regarding this communication.
              </p>
            </div>
          </div>

          <div className="abc-email-signature">
            <p>Kind regards,</p>
            <strong>Adorable British College</strong>
          </div>
        </main>

        <footer className="abc-email-footer">
          <p>
            This email was sent by Adorable British College.
          </p>

          <p>
            This communication may contain information intended only
            for the recipient.
          </p>
        </footer>
      </div>

      <p className="abc-email-copyright">
        © {new Date().getFullYear()} Adorable British College
      </p>
    </div>
  );
}

function ComposeModal({
  mode,
  data,
  event,
  editing,
  close,
}: {
  mode: ComposeMode;
  data: CommunicationOverview;
  event?: LiveEvent;
  editing?: Announcement;
  close: () => void;
}) {
  const client = useQueryClient();

  const announcementMode = mode === "announcement";
  const emailMode = mode === "email";

  const [subject, setSubject] = useState(
    editing?.title ?? event?.title ?? ""
  );

  const [body, setBody] = useState(editing?.body ?? "");

  const [selected, setSelected] = useState(
    () =>
      new Set(
        event?.recipients.map(
          (item) => `${item.type}:${item.id}`
        ) ?? []
      )
  );

  const [recipientSearch, setRecipientSearch] = useState("");

  const [audienceType, setAudienceType] =
    useState<Announcement["audience"]["type"]>(
      editing?.audience.type ?? "ALL"
    );

  const [yearGroupId, setYearGroupId] = useState(
    editing?.audience.ids[0] ?? ""
  );

  const [priority, setPriority] =
    useState<Announcement["priority"]>(
      editing?.priority ?? "NORMAL"
    );

  const [tone, setTone] = useState<
    "WARM" | "FORMAL" | "CONCISE" | "SUPPORTIVE"
  >("WARM");

  const [assisted, setAssisted] = useState(
    editing?.assisted ?? false
  );

  const [notice, setNotice] = useState("");

  /*
   * Email-preview-only state.
   * These values never affect WhatsApp, announcements or portal
   * messages.
   */
  const [emailPreviewMode, setEmailPreviewMode] = useState<
    "desktop" | "mobile"
  >("desktop");

  const [emailPreviewTab, setEmailPreviewTab] = useState<
    "html" | "text"
  >("html");

  const recipients = useMemo<Recipient[]>(
    () => [
      ...data.reference.students.map((item) => ({
        key: `STUDENT:${item.id}`,
        type: "STUDENT" as const,
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        role: `Student${item.enrollments[0]
          ? ` · ${item.enrollments[0].yearGroup.name}`
          : ""
          }`,
        email: item.email,
      })),

      ...data.reference.guardians.map((item) => ({
        key: `GUARDIAN:${item.id}`,
        type: "GUARDIAN" as const,
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        role: "Parent / Guardian",
        email: item.email,
        phone: item.phone,
      })),

      ...data.reference.staff.map((item) => ({
        key: `STAFF:${item.id}`,
        type: "STAFF" as const,
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        role: item.jobTitle,
        email: item.user?.email,
      })),
    ],
    [data]
  );

  const visibleRecipients = recipients.filter(
    (recipient) =>
      `${recipient.name} ${recipient.role}`
        .toLowerCase()
        .includes(recipientSearch.toLowerCase()) &&
      (mode !== "email" || recipient.email) &&
      (mode !== "whatsapp" ||
        (recipient.type === "GUARDIAN" && recipient.phone))
  );

  const selectedRecipients = recipients.filter((recipient) =>
    selected.has(recipient.key)
  );

  const previewRecipient = selectedRecipients[0];

  const previewRecipientName =
    selectedRecipients.length === 1
      ? previewRecipient?.name ?? "Parent/Guardian"
      : selectedRecipients.length > 1
        ? "Parents and Guardians"
        : "Parent/Guardian";

  const audienceLabel =
    audienceType === "YEAR_GROUP"
      ? data.reference.yearGroups.find(
        (item) => item.id === yearGroupId
      )?.name ?? "Year group"
      : audienceType === "ALL"
        ? "Whole school community"
        : audienceType[0] +
        audienceType.slice(1).toLowerCase();

  const assistant = useMutation({
    mutationFn: () =>
      draftCommunicationWithAssistant({
        intent: event
          ? "FOLLOW_UP"
          : announcementMode
            ? "ANNOUNCEMENT"
            : "MESSAGE",

        tone,

        audienceLabel: announcementMode
          ? audienceLabel
          : selected.size === 1
            ? recipients.find((item) =>
              selected.has(item.key)
            )?.name ?? "recipient"
            : `${selected.size || "selected"} recipients`,

        context: event
          ? {
            type: event.type,
            title: event.title,
            details: event.detail,
          }
          : undefined,

        instruction: subject,
      }),

    onSuccess: (draft) => {
      setSubject(draft.subject);
      setBody(draft.body);
      setAssisted(true);

      setNotice(
        "Draft prepared from live context. Please review before sending."
      );
    },

    onError: (error) =>
      setNotice(
        errorMessage(
          error,
          "The drafting assistant could not prepare this message."
        )
      ),
  });

  /*
   * Original communication creation behavior.
   * Kept intact.
   */
  const saveThread = useMutation({
    mutationFn: (draft: boolean) =>
      createCommunicationThread({
        subject,

        type:
          mode === "group" || selected.size > 1
            ? "GROUP"
            : "DIRECT",

        channel:
          mode === "email"
            ? "EMAIL"
            : mode === "whatsapp"
              ? "WHATSAPP"
              : "PORTAL",

        recipients: recipients
          .filter((item) => selected.has(item.key))
          .map(({ type, id }) => ({
            type,
            id,
          })),

        body,
        saveAsDraft: draft,
        assisted,
      }),

    onSuccess: async (thread, draft) => {
      const latest = thread.messages.at(-1);

      await client.invalidateQueries({
        queryKey: ["communication-overview"],
      });

      setNotice(
        draft
          ? "Message saved to drafts."
          : latest?.status === "FAILED"
            ? latest.deliveries.find(
              (item) => item.errorMessage
            )?.errorMessage ?? "Delivery failed."
            : mode === "email"
              ? "Email accepted by Resend. Delivery status will update live."
              : mode === "whatsapp"
                ? "WhatsApp message accepted by Twilio. Delivery status will update live."
                : "Message sent successfully."
      );

      if (draft || latest?.status !== "FAILED") {
        setTimeout(close, 700);
      }
    },

    onError: (error) =>
      setNotice(
        errorMessage(
          error,
          "The message could not be saved."
        )
      ),
  });

  const saveAnnouncement = useMutation({
    mutationFn: (status: Announcement["status"]) => {
      const input = {
        title: subject,
        body,

        audience: {
          type: audienceType,

          ids:
            audienceType === "YEAR_GROUP" && yearGroupId
              ? [yearGroupId]
              : [],
        },

        audienceLabel,
        priority,
        status,
        assisted,
      };

      return editing
        ? updateAnnouncement(editing.id, input)
        : createAnnouncement(input);
    },

    onSuccess: async (_, status) => {
      await client.invalidateQueries({
        queryKey: ["communication-overview"],
      });

      setNotice(
        status === "PUBLISHED"
          ? "Announcement published successfully."
          : "Announcement saved to drafts."
      );

      setTimeout(close, 450);
    },

    onError: (error) =>
      setNotice(
        errorMessage(
          error,
          "The announcement could not be saved."
        )
      ),
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (announcementMode) {
      saveAnnouncement.mutate("PUBLISHED");
    } else {
      saveThread.mutate(false);
    }
  }

  function previewInNewWindow() {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const messageHtml = paragraphs.length
      ? paragraphs
          .map(
            (p) =>
              `<p style="margin:0 0 18px 0;line-height:26px;">${p.replaceAll("\n", "<br>")}</p>`,
          )
          .join("")
      : "";
    const year = new Date().getFullYear();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject || "Email preview"}</title></head><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#172033;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f9;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(18,33,59,.10);"><tr><td style="padding:36px 40px;background:#3b1e78;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="52" valign="middle"><div style="width:48px;height:48px;border-radius:50%;border:2px solid #c4a8f0;text-align:center;line-height:48px;"><span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:1px;">ABC</span></div></td><td style="padding-left:16px;"><div style="font-size:22px;line-height:28px;font-weight:700;color:#fff;">Adorable British College</div><div style="margin-top:4px;font-size:13px;line-height:18px;color:#d4c2f0;">Official School Communication</div></td></tr></table></td></tr><tr><td style="padding:36px 40px 28px 40px;"><div style="margin-bottom:10px;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#7c54b5;">School Communication</div><h1 style="margin:0 0 24px 0;padding-bottom:20px;border-bottom:1px solid #eceef2;font-size:24px;line-height:32px;font-weight:700;color:#172033;">${subject || "Your email subject"}</h1><p style="margin:0 0 20px 0;font-size:16px;line-height:26px;color:#3a4258;">Dear ${previewRecipientName},</p><div style="font-size:16px;line-height:26px;color:#3a4258;">${messageHtml}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;"><tr><td style="padding:16px 18px;background:#f5f3ff;border-left:4px solid #3b1e78;border-radius:8px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="28" valign="top"><div style="width:22px;height:22px;border-radius:50%;background:#3b1e78;color:#fff;text-align:center;font-size:14px;font-weight:700;line-height:22px;">i</div></td><td style="padding-left:12px;"><strong style="display:block;margin-bottom:4px;font-size:14px;color:#3b1e78;">Need assistance?</strong><span style="font-size:13px;line-height:21px;color:#5b5470;">Please contact the school office if you have any questions regarding this communication.</span></td></tr></table></td></tr></table><div style="margin-top:28px;font-size:15px;line-height:24px;color:#3a4258;">Kind regards,<br><strong style="color:#3b1e78;">Adorable British College</strong></div></td></tr><tr><td align="center" style="padding:22px 40px;background:#f9fafb;border-top:1px solid #eceef2;"><p style="margin:0 0 5px 0;font-size:12px;line-height:18px;color:#8a92a0;">This email was sent by Adorable British College.</p><p style="margin:0;font-size:12px;line-height:18px;color:#a0a6b2;">This communication may contain information intended only for the recipient.</p></td></tr></table><div style="max-width:600px;padding:16px 20px 0 20px;text-align:center;font-size:11px;line-height:18px;color:#979daa;">&copy; ${year} Adorable British College</div></td></tr></table></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  }

  function toggleRecipient(recipient: Recipient) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(recipient.key)) {
        next.delete(recipient.key);
      } else {
        next.add(recipient.key);
      }

      return next;
    });
  }

  const pending =
    assistant.isPending ||
    saveThread.isPending ||
    saveAnnouncement.isPending;

  const sendDisabled =
    pending ||
    !subject ||
    !body ||
    (!announcementMode && !selected.size);

  /*
   * Keep the original recipient picker reusable between the normal
   * composer and the new email composer.
   */
  const recipientPicker = (
    <div className="communication-recipient-picker">
      <div className="recipient-picker-head">
        <label>
          <Search />

          <input
            value={recipientSearch}
            onChange={(e) =>
              setRecipientSearch(e.target.value)
            }
            placeholder={
              mode === "whatsapp"
                ? "Search parents or guardians with WhatsApp..."
                : "Search students, parents or staff..."
            }
          />
        </label>

        <strong>{selected.size} selected</strong>
      </div>

      <div className="recipient-options">
        {visibleRecipients.map((recipient) => (
          <label
            key={recipient.key}
            className={
              selected.has(recipient.key) ? "selected" : ""
            }
          >
            <input
              type="checkbox"
              checked={selected.has(recipient.key)}
              onChange={() => toggleRecipient(recipient)}
            />

            <span>{initials(recipient.name)}</span>

            <div>
              <strong>{recipient.name}</strong>

              <small>
                {recipient.role}

                {mode === "email"
                  ? ` · ${recipient.email}`
                  : mode === "whatsapp"
                    ? ` · ${recipient.phone}`
                    : ""}
              </small>
            </div>

            <Check />
          </label>
        ))}

        {!visibleRecipients.length && (
          <div className="communication-recipient-empty">
            No matching recipients found.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="modal-scrim communication-modal-scrim"
      onMouseDown={close}
    >
      <form
        className={`modal-dialog communication-compose-modal ${emailMode ? "communication-email-compose-modal" : ""
          }`}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        {/* HEADER */}

        <div className="modal-header">
          <div>
            <h2>
              {editing
                ? "Edit announcement"
                : mode === "announcement"
                  ? "Create announcement"
                  : mode === "email"
                    ? "Compose email"
                    : mode === "whatsapp"
                      ? "Send WhatsApp message"
                      : mode === "group"
                        ? "Start group message"
                        : "Send message"}
            </h2>

            <p>
              Recipients and school context use live database
              records.
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={close}
          >
            <X />
          </button>
        </div>

        {/* DRAFTING ASSISTANT */}

        <div className="communication-assistant">
          <Bot />

          <div>
            <strong>Communication drafting assistant</strong>

            <small>
              Build a clear draft using the selected audience and
              live event context.
            </small>
          </div>

          <select
            value={tone}
            onChange={(e) =>
              setTone(e.target.value as typeof tone)
            }
          >
            <option value="WARM">Warm</option>
            <option value="FORMAL">Formal</option>
            <option value="CONCISE">Concise</option>
            <option value="SUPPORTIVE">Supportive</option>
          </select>

          <button
            type="button"
            disabled={pending}
            onClick={() => assistant.mutate()}
          >
            <Sparkles />

            {assistant.isPending
              ? "Drafting..."
              : "Draft for me"}
          </button>
        </div>

        {/* ======================================================
            EMAIL COMPOSER
            ====================================================== */}

        {emailMode ? (
          <div className="communication-email-workspace">
            {/* LEFT — EDITOR */}

            <section className="communication-email-editor">
              <div className="communication-email-editor-inner">
                <div className="communication-email-section">
                  <label className="communication-email-label">
                    Recipients
                  </label>

                  <div className="email-recipient-container">
                    <div className="email-recipient-search-row">
                      <Search />

                      <input
                        value={recipientSearch}
                        onChange={(e) =>
                          setRecipientSearch(e.target.value)
                        }
                        placeholder="Search students, parents or staff..."
                      />

                      <strong className="email-recipient-count">
                        {selected.size} selected
                      </strong>
                    </div>

                    {selectedRecipients.length > 0 && (
                      <div className="email-recipient-selected-list">
                        {selectedRecipients.map((recipient) => (
                          <div
                            key={recipient.key}
                            className="email-recipient-selected-item"
                          >
                            <span className="email-recipient-avatar">
                              {initials(recipient.name)}
                            </span>

                            <div className="email-recipient-info">
                              <strong>{recipient.name}</strong>

                              <small>
                                {recipient.role}

                                {recipient.email
                                  ? ` · ${recipient.email}`
                                  : ""}
                              </small>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                toggleRecipient(recipient)
                              }
                            >
                              <X />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {recipientSearch && (
                      <div className="email-recipient-results">
                        {visibleRecipients.map((recipient) => (
                          <button
                            type="button"
                            key={recipient.key}
                            className={
                              selected.has(recipient.key)
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              toggleRecipient(recipient)
                            }
                          >
                            <span>
                              {initials(recipient.name)}
                            </span>

                            <div>
                              <strong>
                                {recipient.name}
                              </strong>

                              <small>
                                {recipient.role}

                                {recipient.email
                                  ? ` · ${recipient.email}`
                                  : ""}
                              </small>
                            </div>

                            {selected.has(recipient.key) ? (
                              <Check />
                            ) : (
                              <Plus />
                            )}
                          </button>
                        ))}

                        {!visibleRecipients.length && (
                          <div className="communication-recipient-empty">
                            No matching recipients found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <label className="communication-email-field">
                  <span>Subject</span>

                  <input
                    value={subject}
                    onChange={(e) =>
                      setSubject(e.target.value)
                    }
                    required
                    maxLength={180}
                    placeholder="Enter a clear subject"
                  />
                </label>

                <label className="communication-email-field">
                  <span>Message</span>

                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={12}
                    maxLength={2000}
                    placeholder="Write your message..."
                  />

                  <small className="communication-character-count">
                    {body.length}/2000
                  </small>
                </label>

                {event && (
                  <div
                    className={`communication-event-context ${event.severity.toLowerCase()}`}
                  >
                    <strong>{event.type} live event</strong>
                    <span>{event.title}</span>
                    <small>{event.detail}</small>
                  </div>
                )}

                {subject &&
                  body &&
                  selected.size > 0 &&
                  !notice && (
                    <div className="communication-email-validation">
                      <Check />

                      Your message looks good. Review the
                      preview before sending.
                    </div>
                  )}

                {notice && (
                  <div
                    className={`communication-compose-notice ${notice.includes("could not") ||
                      notice.includes("failed") ||
                      notice.includes("rejected")
                      ? "error"
                      : ""
                      }`}
                  >
                    {notice}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT — LIVE EMAIL PREVIEW */}

            <section className="communication-email-preview-panel">
              <header className="email-preview-toolbar">
                <div className="email-preview-tabs">
                  <button
                    type="button"
                    className={
                      emailPreviewTab === "html"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setEmailPreviewTab("html")
                    }
                  >
                    <Mail />
                    <span>Email preview</span>
                  </button>

                  <button
                    type="button"
                    className={
                      emailPreviewTab === "text"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setEmailPreviewTab("text")
                    }
                  >
                    <MessageSquare />
                    <span>Plain text</span>
                  </button>
                </div>

                <div className="email-device-switch">
                  <button
                    type="button"
                    className={
                      emailPreviewMode === "desktop"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setEmailPreviewMode("desktop")
                    }
                  >
                    Desktop
                  </button>

                  <button
                    type="button"
                    className={
                      emailPreviewMode === "mobile"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setEmailPreviewMode("mobile")
                    }
                  >
                    Mobile
                  </button>
                </div>
              </header>

              {emailPreviewTab === "html" ? (
                <EmailPreview
                  subject={subject}
                  body={body}
                  recipientName={previewRecipientName}
                  mobile={emailPreviewMode === "mobile"}
                />
              ) : (
                <div
                  className={`abc-plain-preview ${emailPreviewMode === "mobile"
                    ? "mobile"
                    : ""
                    }`}
                >
                  <h3>
                    {subject || "Your email subject"}
                  </h3>

                  <p>
                    Dear {previewRecipientName},
                  </p>

                  <div className="abc-plain-message">
                    {body ||
                      "Your message will appear here as you type..."}
                  </div>

                  <p>
                    Kind regards,
                    <br />
                    <strong>
                      Adorable British College
                    </strong>
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ====================================================
             ORIGINAL NON-EMAIL COMPOSER
             ==================================================== */

          <div className="modal-body communication-compose-body">
            {announcementMode ? (
              <div className="communication-form-row">
                <label>
                  Audience

                  <select
                    value={audienceType}
                    onChange={(e) =>
                      setAudienceType(
                        e.target
                          .value as typeof audienceType
                      )
                    }
                  >
                    <option value="ALL">
                      Whole school
                    </option>

                    <option value="STUDENTS">
                      All students
                    </option>

                    <option value="GUARDIANS">
                      All parents / guardians
                    </option>

                    <option value="STAFF">
                      All staff
                    </option>

                    <option value="YEAR_GROUP">
                      Specific year group
                    </option>
                  </select>
                </label>

                {audienceType === "YEAR_GROUP" && (
                  <label>
                    Year group

                    <select
                      value={yearGroupId}
                      required
                      onChange={(e) =>
                        setYearGroupId(e.target.value)
                      }
                    >
                      <option value="">
                        Select year group
                      </option>

                      {data.reference.yearGroups.map(
                        (group) => (
                          <option
                            key={group.id}
                            value={group.id}
                          >
                            {group.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                <label>
                  Priority

                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(
                        e.target.value as typeof priority
                      )
                    }
                  >
                    <option>NORMAL</option>
                    <option>IMPORTANT</option>
                    <option>URGENT</option>
                  </select>
                </label>
              </div>
            ) : (
              recipientPicker
            )}

            <label>
              Subject

              <input
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                required
                maxLength={180}
                placeholder="Enter a clear subject"
              />
            </label>

            <label>
              Message

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={9}
                maxLength={10_000}
                placeholder="Write your message..."
              />
            </label>

            {event && (
              <div
                className={`communication-event-context ${event.severity.toLowerCase()}`}
              >
                <strong>{event.type} live event</strong>
                <span>{event.title}</span>
                <small>{event.detail}</small>
              </div>
            )}

            {notice && (
              <div
                className={`communication-compose-notice ${notice.includes("could not")
                  ? "error"
                  : ""
                  }`}
              >
                {notice}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}

        <div className="modal-footer">
          {emailMode && (
            <button
              type="button"
              className="secondary-button"
              onClick={previewInNewWindow}
            >
              Preview in new window
            </button>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={close}
          >
            Cancel
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={
              pending ||
              (!announcementMode &&
                (!subject || !body || !selected.size))
            }
            onClick={() =>
              announcementMode
                ? saveAnnouncement.mutate("DRAFT")
                : saveThread.mutate(true)
            }
          >
            Save Draft
          </button>

          <button
            className="primary-button"
            disabled={sendDisabled}
          >
            <Send />

            {announcementMode
              ? "Publish Announcement"
              : mode === "email"
                ? "Send Email"
                : mode === "whatsapp"
                  ? "Send WhatsApp"
                  : "Send Message"}
          </button>
        </div>
      </form>
    </div>
  );
}

// function ComposeModal({ mode, data, event, editing, close }: { mode: ComposeMode; data: CommunicationOverview; event?: LiveEvent; editing?: Announcement; close: () => void }) {
//   const client = useQueryClient();
//   const announcementMode = mode === "announcement";
//   const [subject, setSubject] = useState(editing?.title ?? event?.title ?? "");
//   const [body, setBody] = useState(editing?.body ?? "");
//   const [selected, setSelected] = useState(() => new Set(event?.recipients.map((item) => `${item.type}:${item.id}`) ?? []));
//   const [recipientSearch, setRecipientSearch] = useState("");
//   const [audienceType, setAudienceType] = useState<Announcement["audience"]["type"]>(editing?.audience.type ?? "ALL");
//   const [yearGroupId, setYearGroupId] = useState(editing?.audience.ids[0] ?? "");
//   const [priority, setPriority] = useState<Announcement["priority"]>(editing?.priority ?? "NORMAL");
//   const [tone, setTone] = useState<"WARM" | "FORMAL" | "CONCISE" | "SUPPORTIVE">("WARM");
//   const [assisted, setAssisted] = useState(editing?.assisted ?? false);
//   const [notice, setNotice] = useState("");
//   const recipients = useMemo<Recipient[]>(() => [
//     ...data.reference.students.map((item) => ({ key: `STUDENT:${item.id}`, type: "STUDENT" as const, id: item.id, name: `${item.firstName} ${item.lastName}`, role: `Student${item.enrollments[0] ? ` · ${item.enrollments[0].yearGroup.name}` : ""}`, email: item.email })),
//     ...data.reference.guardians.map((item) => ({ key: `GUARDIAN:${item.id}`, type: "GUARDIAN" as const, id: item.id, name: `${item.firstName} ${item.lastName}`, role: "Parent / Guardian", email: item.email, phone: item.phone })),
//     ...data.reference.staff.map((item) => ({ key: `STAFF:${item.id}`, type: "STAFF" as const, id: item.id, name: `${item.firstName} ${item.lastName}`, role: item.jobTitle, email: item.user?.email })),
//   ], [data]);
//   const visibleRecipients = recipients.filter((recipient) => `${recipient.name} ${recipient.role}`.toLowerCase().includes(recipientSearch.toLowerCase()) && (mode !== "email" || recipient.email) && (mode !== "whatsapp" || (recipient.type === "GUARDIAN" && recipient.phone)));
//   const audienceLabel = audienceType === "YEAR_GROUP" ? data.reference.yearGroups.find((item) => item.id === yearGroupId)?.name ?? "Year group" : audienceType === "ALL" ? "Whole school community" : audienceType[0] + audienceType.slice(1).toLowerCase();
//   const assistant = useMutation({
//     mutationFn: () => draftCommunicationWithAssistant({ intent: event ? "FOLLOW_UP" : announcementMode ? "ANNOUNCEMENT" : "MESSAGE", tone, audienceLabel: announcementMode ? audienceLabel : selected.size === 1 ? recipients.find((item) => selected.has(item.key))?.name ?? "recipient" : `${selected.size || "selected"} recipients`, context: event ? { type: event.type, title: event.title, details: event.detail } : undefined, instruction: subject }),
//     onSuccess: (draft) => { setSubject(draft.subject); setBody(draft.body); setAssisted(true); setNotice("Draft prepared from live context. Please review before sending."); },
//     onError: (error) => setNotice(errorMessage(error, "The drafting assistant could not prepare this message.")),
//   });
//   const saveThread = useMutation({
//     mutationFn: (draft: boolean) => createCommunicationThread({ subject, type: mode === "group" || selected.size > 1 ? "GROUP" : "DIRECT", channel: mode === "email" ? "EMAIL" : mode === "whatsapp" ? "WHATSAPP" : "PORTAL", recipients: recipients.filter((item) => selected.has(item.key)).map(({ type, id }) => ({ type, id })), body, saveAsDraft: draft, assisted }),
//     onSuccess: async (thread, draft) => { const latest = thread.messages.at(-1); await client.invalidateQueries({ queryKey: ["communication-overview"] }); setNotice(draft ? "Message saved to drafts." : latest?.status === "FAILED" ? latest.deliveries.find((item) => item.errorMessage)?.errorMessage ?? "Delivery failed." : mode === "email" ? "Email accepted by Resend. Delivery status will update live." : mode === "whatsapp" ? "WhatsApp message accepted by Twilio. Delivery status will update live." : "Message sent successfully."); if (draft || latest?.status !== "FAILED") setTimeout(close, 700); },
//     onError: (error) => setNotice(errorMessage(error, "The message could not be saved.")),
//   });
//   const saveAnnouncement = useMutation({
//     mutationFn: (status: Announcement["status"]) => {
//       const input = { title: subject, body, audience: { type: audienceType, ids: audienceType === "YEAR_GROUP" && yearGroupId ? [yearGroupId] : [] }, audienceLabel, priority, status, assisted };
//       return editing ? updateAnnouncement(editing.id, input) : createAnnouncement(input);
//     },
//     onSuccess: async (_, status) => { await client.invalidateQueries({ queryKey: ["communication-overview"] }); setNotice(status === "PUBLISHED" ? "Announcement published successfully." : "Announcement saved to drafts."); setTimeout(close, 450); },
//     onError: (error) => setNotice(errorMessage(error, "The announcement could not be saved.")),
//   });
//   function submit(event: FormEvent) { event.preventDefault(); if (announcementMode) saveAnnouncement.mutate("PUBLISHED"); else saveThread.mutate(false); }
//   const pending = assistant.isPending || saveThread.isPending || saveAnnouncement.isPending;
//   return <div className="modal-scrim communication-modal-scrim" onMouseDown={close}><form className="modal-dialog communication-compose-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
//     <div className="modal-header"><div><h2>{editing ? "Edit announcement" : mode === "announcement" ? "Create announcement" : mode === "email" ? "Compose email" : mode === "whatsapp" ? "Send WhatsApp message" : mode === "group" ? "Start group message" : "Send message"}</h2><p>Recipients and school context use live database records.</p></div><button type="button" className="icon-button" onClick={close}><X /></button></div>
//     <div className="communication-assistant"><Bot/><div><strong>Communication drafting assistant</strong><small>Build a clear draft using the selected audience and live event context.</small></div><select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}><option value="WARM">Warm</option><option value="FORMAL">Formal</option><option value="CONCISE">Concise</option><option value="SUPPORTIVE">Supportive</option></select><button type="button" disabled={pending} onClick={() => assistant.mutate()}><Sparkles/>{assistant.isPending ? "Drafting..." : "Draft for me"}</button></div>
//     <div className="modal-body communication-compose-body">
//       {announcementMode ? <div className="communication-form-row"><label>Audience<select value={audienceType} onChange={(e) => setAudienceType(e.target.value as typeof audienceType)}><option value="ALL">Whole school</option><option value="STUDENTS">All students</option><option value="GUARDIANS">All parents / guardians</option><option value="STAFF">All staff</option><option value="YEAR_GROUP">Specific year group</option></select></label>{audienceType === "YEAR_GROUP" && <label>Year group<select value={yearGroupId} required onChange={(e) => setYearGroupId(e.target.value)}><option value="">Select year group</option>{data.reference.yearGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}<label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option>NORMAL</option><option>IMPORTANT</option><option>URGENT</option></select></label></div> : <div className="communication-recipient-picker"><div className="recipient-picker-head"><label><Search/><input value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} placeholder={mode === "whatsapp" ? "Search parents or guardians with WhatsApp..." : "Search students, parents or staff..."}/></label><strong>{selected.size} selected</strong></div><div className="recipient-options">{visibleRecipients.map((recipient) => <label key={recipient.key} className={selected.has(recipient.key) ? "selected" : ""}><input type="checkbox" checked={selected.has(recipient.key)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(recipient.key)) next.delete(recipient.key); else next.add(recipient.key); return next; })}/><span>{initials(recipient.name)}</span><div><strong>{recipient.name}</strong><small>{recipient.role}{mode === "email" ? ` · ${recipient.email}` : mode === "whatsapp" ? ` · ${recipient.phone}` : ""}</small></div><Check/></label>)}</div></div>}
//       <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={180} placeholder="Enter a clear subject"/></label>
//       <label>Message<textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={9} maxLength={10_000} placeholder="Write your message..."/></label>
//       {event && <div className={`communication-event-context ${event.severity.toLowerCase()}`}><strong>{event.type} live event</strong><span>{event.title}</span><small>{event.detail}</small></div>}
//       {notice && <div className={`communication-compose-notice ${notice.includes("could not") ? "error" : ""}`}>{notice}</div>}
//     </div>
//     <div className="modal-footer"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="button" className="secondary-button" disabled={pending || (!announcementMode && (!subject || !body || !selected.size))} onClick={() => announcementMode ? saveAnnouncement.mutate("DRAFT") : saveThread.mutate(true)}>Save Draft</button><button className="primary-button" disabled={pending || !subject || !body || (!announcementMode && !selected.size)}><Send/>{announcementMode ? "Publish Announcement" : mode === "email" ? "Send Email" : mode === "whatsapp" ? "Send WhatsApp" : "Send Message"}</button></div>
//   </form></div>;
// }

function Conversation({ thread, currentUserId, reply, archive, unavailable }: { thread: CommunicationThread; currentUserId?: string; reply: (body: string) => void; archive: () => void; unavailable: (feature: string) => void }) {
  const [message, setMessage] = useState("");
  return <section className="communication-chat"><header><span>{initials(thread.participants[0]?.displayName ?? "Conversation")}</span><div><strong>{thread.subject}</strong><small>{thread.participants.map((item) => item.displayName).join(", ")} · {thread.channel === "EMAIL" ? "Email" : thread.channel === "WHATSAPP" ? "WhatsApp" : "Portal"}</small></div><button title="Voice calling setup" onClick={() => unavailable("Voice calling")}><Phone /></button><button title="Video calling setup" onClick={() => unavailable("Video calling")}><Video /></button><button title="Archive conversation" onClick={archive}><Archive /></button></header><div className="communication-messages">{thread.messages.map((item) => { const own = item.senderUserId === currentUserId; const senderName = item.sender ? `${item.sender.firstName} ${item.sender.lastName}` : item.senderParticipant?.displayName ?? "Guardian"; return <div className={own ? "own" : ""} key={item.id}><span>{initials(senderName)}</span><article><p>{item.body}</p><small>{ago(item.createdAt)} · {item.status.toLowerCase()}{item.assisted ? " · assisted draft" : ""}</small>{item.deliveries.some((delivery) => delivery.status === "FAILED") && <em>{item.deliveries.find((delivery) => delivery.errorMessage)?.errorMessage ?? "Delivery failed"}</em>}</article></div>; })}</div><form className="communication-reply" onSubmit={(e) => { e.preventDefault(); if (!message.trim()) return; reply(message); setMessage(""); }}><button type="button" title="Attachment provider setup" onClick={() => unavailable("File attachments")}><Paperclip /></button><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={thread.channel === "EMAIL" ? "Write an email reply..." : thread.channel === "WHATSAPP" ? "Write a WhatsApp reply..." : "Type a message..."} /><button title="Send reply"><Send /></button></form></section>;
}

export function CommunicationPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const overview = useQuery({ queryKey: ["communication-overview"], queryFn: getCommunicationOverview, refetchInterval: 30_000 });
  const data = overview.data;
  const [tab, setTab] = useState<TabName>("inbox");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ mode: ComposeMode; event?: LiveEvent; editing?: Announcement } | null>(null);
  const [notice, setNotice] = useState("");
  const threads = useMemo(() => {
    if (!data) return [];
    const value = search.toLowerCase();
    return data.threads.filter((thread) => {
      const matchesSearch = `${thread.subject} ${thread.participants.map((item) => item.displayName).join(" ")} ${thread.messages.at(-1)?.body ?? ""}`.toLowerCase().includes(value);
      if (!matchesSearch) return false;
      if (tab === "sent") return thread.messages.some((item) => item.senderUserId === user?.id && item.status !== "DRAFT");
      if (tab === "drafts") return thread.messages.some((item) => item.status === "DRAFT");
      return !thread.messages.some((item) => item.status === "DRAFT");
    });
  }, [data, search, tab, user?.id]);
  const selected = threads.find((thread) => thread.id === selectedId) ?? threads[0];
  const invalidate = async () => client.invalidateQueries({ queryKey: ["communication-overview"] });
  const reply = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => sendCommunicationMessage(id, { body, saveAsDraft: false, assisted: false }), onSuccess: invalidate, onError: (error) => setNotice(errorMessage(error, "Reply could not be sent.")) });
  const archiveThread = useMutation({ mutationFn: (id: string) => archiveCommunicationThread(id), onSuccess: async () => { setSelectedId(null); await invalidate(); setNotice("Conversation archived."); }, onError: (error) => setNotice(errorMessage(error, "Conversation could not be archived.")) });
  const removeAnnouncement = useMutation({ mutationFn: (id: string) => archiveAnnouncement(id), onSuccess: async () => { await invalidate(); setNotice("Announcement archived."); }, onError: (error) => setNotice(errorMessage(error, "Announcement could not be archived.")) });
  async function chooseThread(thread: CommunicationThread) { setSelectedId(thread.id); await markCommunicationThreadRead(thread.id); await invalidate(); }
  const actions = [
    { mode: "message" as const, icon: <MessageSquare />, title: "Send Message", note: "Message a student, parent or staff member", tone: "blue" },
    { mode: "announcement" as const, icon: <Megaphone />, title: "Create Announcement", note: "Share important updates with your community", tone: "green" },
    { mode: "group" as const, icon: <Users />, title: "Group Message", note: "Send to multiple recipients at once", tone: "purple" },
    { mode: "email" as const, icon: <Mail />, title: "Compose Email", note: "Deliver email to staff, parents or guardians", tone: "orange" },
    { mode: "whatsapp" as const, icon: <MessageCircle />, title: "WhatsApp Parent", note: "Deliver directly to a guardian's WhatsApp", tone: "whatsapp" },
  ];
  return <div className="admin-page-container communication-page"><div className="breadcrumb-nav"><Home size={14} /><span>/</span><strong>Communication</strong></div><div className="admin-page-header communication-header"><div className="admin-page-title-group"><h1>Communication</h1><p>Stay connected with students, parents and staff. Send messages, announcements and live-event updates.</p></div><div className="context-select"><CalendarDays />Academic Year {data?.academicYear?.name ?? "Not configured"}<ChevronDown /></div></div>
    {notice && <div className={`timetable-feedback ${notice.includes("could not") ? "error" : "success"}`}>{notice}<button onClick={() => setNotice("")}><X /></button></div>}
    {data && <><div className="communication-provider-strip"><span className={data.providers.whatsapp.configured ? "ready" : "setup"}><MessageCircle /><strong>WhatsApp</strong><small>{data.providers.whatsapp.configured ? data.providers.whatsapp.webhookConfigured ? "Live delivery and receipts ready" : "Sending ready · public webhook URL required for receipts" : "Twilio setup required"}</small></span><span className={data.providers.email.configured ? "ready" : "setup"}><Mail /><strong>Email</strong><small>{data.providers.email.configured ? data.providers.email.webhookConfigured ? "Live delivery and receipts ready" : "Sending ready · webhook secret required for receipts" : "Resend setup required"}</small></span></div><div className="communication-primary-actions">{actions.map((action) => <ActionCard key={action.mode} {...action} onClick={() => setCompose({ mode: action.mode })} />)}</div><div className="communication-layout">
      <section className="communication-inbox"><nav>{(["inbox", "sent", "announcements", "drafts"] as TabName[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{TAB_LABELS[item]}{item === "inbox" && <i>{data.threads.length}</i>}{item === "drafts" && data.stats.drafts > 0 && <i>{data.stats.drafts}</i>}</button>)}</nav>{tab === "announcements" ? <div className="communication-announcement-list"><header><strong>Announcements</strong><button onClick={() => setCompose({ mode: "announcement" })}><Plus />New</button></header>{data.announcements.filter((item) => item.status === "PUBLISHED").map((item) => <article key={item.id}><span className={item.priority.toLowerCase()}><Megaphone /></span><div><strong>{item.title}</strong><small>{item.audienceLabel} · {ago(item.publishedAt ?? item.createdAt)}</small><p>{item.body}</p></div><button onClick={() => setCompose({ mode: "announcement", editing: item })}><Edit3 /></button><button onClick={() => removeAnnouncement.mutate(item.id)}><Archive /></button></article>)}</div> : tab === "drafts" ? <div className="communication-announcement-list"><header><strong>Saved drafts</strong></header>{data.announcements.filter((item) => item.status === "DRAFT").map((item) => <article key={item.id}><span><Edit3 /></span><div><strong>{item.title}</strong><small>{item.audienceLabel}</small><p>{item.body}</p></div><button onClick={() => setCompose({ mode: "announcement", editing: item })}><Edit3 /></button><button onClick={() => removeAnnouncement.mutate(item.id)}><Archive /></button></article>)}</div> : <><label className="communication-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages, people or subjects..." /></label><div className="conversation-list">{threads.map((thread) => { const participant = thread.participants[0]; const last = thread.messages.at(-1); return <button className={selected?.id === thread.id ? "active" : ""} key={thread.id} onClick={() => void chooseThread(thread)}><span>{initials(participant?.displayName ?? thread.subject)}</span><div><strong>{thread.type === "GROUP" ? thread.subject : participant?.displayName ?? thread.subject}<i>{participant?.roleLabel}</i></strong><b>{thread.subject}</b><small>{last?.body ?? "No messages yet"}</small></div><time>{ago(thread.lastMessageAt)}</time>{last?.status === "QUEUED" && <em>Queued</em>}</button>; })}{!threads.length && <div className="communication-empty"><MessageCircle /><strong>No conversations found</strong><span>Start a new message using the actions above.</span></div>}</div></>}</section>
      {tab === "inbox" || tab === "sent" ? selected ? <Conversation thread={selected} currentUserId={user?.id} reply={(body) => reply.mutate({ id: selected.id, body })} archive={() => archiveThread.mutate(selected.id)} unavailable={(feature) => setNotice(`${feature} requires a configured communications provider.`)} /> : <section className="communication-chat communication-empty-chat"><MessageCircle /><strong>Select a conversation</strong></section> : <section className="communication-chat communication-announcement-preview"><Megaphone /><h2>{tab === "drafts" ? "Draft workspace" : "Published announcements"}</h2><p>Select an announcement to edit it, or create a new update for the school community.</p><button onClick={() => setCompose({ mode: "announcement" })}><Plus />Create Announcement</button></section>}
      <aside className="communication-sidebar"><section><h2>Quick Actions</h2>{actions.map((action) => <button key={action.mode} onClick={() => setCompose({ mode: action.mode })}><span className={action.tone}>{action.icon}</span><div><strong>{action.title}</strong><small>{action.note}</small></div><ArrowRight /></button>)}</section><section><header><h2>Recent Announcements</h2><button onClick={() => setTab("announcements")}>View all <ArrowRight /></button></header>{data.announcements.filter((item) => item.status === "PUBLISHED").slice(0, 4).map((item) => <article className="announcement-mini" key={item.id}><span><Megaphone /></span><div><strong>{item.title}</strong><small>{item.audienceLabel}</small></div><time>{ago(item.publishedAt ?? item.createdAt)}</time></article>)}{!data.announcements.some((item) => item.status === "PUBLISHED") && <p className="communication-side-empty">Published announcements will appear here.</p>}</section><section><h2>Communication Stats</h2><div className="communication-stats"><span><MessageSquare /><strong>{data.stats.messagesSent}</strong><small>Messages Sent</small></span><span><Megaphone /><strong>{data.stats.announcements}</strong><small>Announcements</small></span><span><Users /><strong>{data.stats.groupChats}</strong><small>Group Chats</small></span><span><Mail /><strong>{data.stats.queuedEmails}</strong><small>Queued Emails</small></span></div></section><section className="live-events"><header><h2><Sparkles />Live Events</h2><b>{data.liveEvents.length}</b></header>{data.liveEvents.slice(0, 4).map((event) => <article key={event.id}><i className={event.severity.toLowerCase()} /><div><strong>{event.title}</strong><small>{event.detail}</small></div><button title="Draft follow-up" onClick={() => setCompose({ mode: "message", event })}><Bot /></button></article>)}{!data.liveEvents.length && <p className="communication-side-empty">No live events currently require communication.</p>}</section></aside>
    </div></>}
    {overview.isLoading && <section className="reports-panel academic-loading">Loading communication workspace...</section>}{overview.isError && <div className="form-error">{errorMessage(overview.error, "Communication records could not be loaded.")}</div>}
    {compose && data && <ComposeModal mode={compose.mode} data={data} event={compose.event} editing={compose.editing} close={() => setCompose(null)} />} </div>;
}
