import {
  Award, Bell, BookOpen, CalendarDays, ChevronDown, ClipboardCheck, CreditCard,
  FileBarChart, FileSpreadsheet, GraduationCap, HeartHandshake, HelpCircle,
  Layers, LayoutDashboard, LogOut, Menu, MessageSquare, Search, Settings2,
  ShieldAlert, ShieldCheck, UserCheck, Users, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { getAdminAdmissions, getStudents } from "../lib/api";

interface NavModule {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  hasSubmenu?: boolean;
}

const navModules: NavModule[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/admissions", label: "Admissions", icon: GraduationCap, hasSubmenu: true },
  { to: "/academics", label: "Academics", icon: BookOpen },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/behaviour", label: "Behaviour", icon: Award },
  { to: "/pastoral", label: "Pastoral", icon: HeartHandshake },
  { to: "/safeguarding", label: "Safeguarding", icon: ShieldAlert },
  { to: "/send", label: "SEND", icon: Layers },
  { to: "/exams", label: "Exams", icon: FileSpreadsheet },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/communication", label: "Communication", icon: MessageSquare },
  { to: "/finance", label: "Finance", icon: CreditCard },
  { to: "/operations", label: "Operations", icon: Settings2 },
  { to: "/staff", label: "Staff", icon: UserCheck },
  { to: "/administration", label: "Administration", icon: ShieldCheck },
];

const admissionsSubmenu = [
  { to: "/admissions", label: "Overview" },
  { to: "/admissions/applications", label: "Applications" },
  { to: "/admissions/offers", label: "Offers" },
  { to: "/admissions/waiting-list", label: "Waiting List" },
  { to: "/admissions/enrolments", label: "Enrolments" },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [admissionsExpanded, setAdmissionsExpanded] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery.trim());
  const studentSearch = useQuery({ queryKey: ["global-students", deferredSearch], queryFn: () => getStudents(deferredSearch, 1, 5), enabled: searchOpen && deferredSearch.length >= 2 });
  const admissionSearch = useQuery({ queryKey: ["global-admissions", deferredSearch], queryFn: () => getAdminAdmissions({ search: deferredSearch, pageSize: 5 }), enabled: searchOpen && deferredSearch.length >= 2 });

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Auto-expand Admissions when inside admissions routes
  useEffect(() => {
    if (location.pathname.startsWith("/admissions")) {
      setAdmissionsExpanded(true);
    }
  }, [location.pathname]);

  // Global shortcut ⌘K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setHelpOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const initials = `${user?.firstName?.[0] ?? "A"}${user?.lastName?.[0] ?? "D"}`;
  const fullName = user ? `${user.firstName} ${user.lastName}` : "Administrator";
  const userRole = user?.roles?.[0]?.replace("_", " ") ?? "System Admin";

  const moduleResults = [
    { title: "Dashboard", category: "Modules", path: "/dashboard" },
    { title: "Student Directory", category: "Modules", path: "/students" },
    { title: "Admissions Overview", category: "Modules", path: "/admissions" },
    { title: "All Applications", category: "Modules", path: "/admissions/applications" },
    { title: "Attendance Registers", category: "Modules", path: "/attendance" },
    { title: "Academic Performance", category: "Modules", path: "/academics" },
    { title: "Timetable & Cover", category: "Modules", path: "/timetable" },
  ].filter((item) => !deferredSearch || item.title.toLowerCase().includes(deferredSearch.toLowerCase()));
  const searchResults = [
    ...moduleResults,
    ...(studentSearch.data?.items.map((student) => ({ title: `${student.firstName} ${student.lastName} (${student.admissionNumber})`, category: "Students", path: "/students" })) ?? []),
    ...(admissionSearch.data?.items.map((application) => ({ title: `${application.firstName} ${application.lastName} (${application.applicationNumber})`, category: "Applications", path: `/admissions/${application.id}` })) ?? []),
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand-box">
          <Link to="/dashboard" className="sidebar-logo-card" onClick={() => setMobileOpen(false)}>
            <img src="/abc-logo.png" alt="Adorable British College" />
          </Link>
        </div>

        <nav aria-label="Main navigation">
          {navModules.map((item) => {
            const Icon = item.icon;
            const isAdmissions = item.label === "Admissions";
            const isActive = isAdmissions
              ? location.pathname.startsWith("/admissions")
              : location.pathname === item.to;

            if (isAdmissions) {
              return (
                <div key={item.to} className="sidebar-group">
                  <button
                    type="button"
                    className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setAdmissionsExpanded((prev) => !prev);
                      if (!location.pathname.startsWith("/admissions")) {
                        navigate(item.to);
                        setMobileOpen(false);
                      }
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown
                      size={15}
                      className={`nav-chevron ${admissionsExpanded ? "open" : ""}`}
                    />
                  </button>

                  {admissionsExpanded && (
                    <div className="sidebar-submenu">
                      {admissionsSubmenu.map((sub) => {
                        const isSubActive = location.pathname === sub.to;
                        return (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            end={sub.to === "/admissions"}
                            className={`sidebar-sub-item ${isSubActive ? "active" : ""}`}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span className="sub-bullet" />
                            <span>{sub.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: matchActive }) =>
                  `sidebar-nav-item ${matchActive ? "active" : ""}`
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-motto">Excellence · Character · Global Vision</p>
        </div>
      </aside>

      {/* Scrim for mobile */}
      {mobileOpen && (
        <button
          className="modal-scrim"
          style={{ zIndex: 25 }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Shell Content */}
      <div className="shell-content">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="icon-button"
              id="mobile-nav-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <button
              type="button"
              className="topbar-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Open global search"
            >
              <Search size={16} />
              <span>Search students, staff, subjects, or modules...</span>
              <kbd>⌘ K</kbd>
            </button>
          </div>

          <div className="topbar-right">
            {/* Notifications */}
            <div className="topbar-icon-wrap" ref={notifRef}>
              <button
                type="button"
                className="icon-button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="View notifications"
              >
                <Bell size={19} />
              </button>

              {notificationsOpen && (
                <div className="notifications-popover">
                  <div className="notifications-popover-header">
                    <h3>Notifications</h3>
                    <button
                      className="text-button"
                      style={{ fontSize: 12 }}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="notifications-list">
                    <div className="notification-empty">No new notifications.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Help Button */}
            <button
              type="button"
              className="help-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open help guide"
            >
              <HelpCircle size={17} />
              <span>Help</span>
            </button>

            {/* Profile Menu */}
            <div className="topbar-icon-wrap" ref={profileRef}>
              <button
                type="button"
                className="topbar-profile-pill"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="User profile options"
              >
                <div className="user-avatar-circle">{initials}</div>
                <div className="user-info-text">
                  <span className="user-info-name">{fullName}</span>
                  <span className="user-info-role">{userRole}</span>
                </div>
                <ChevronDown size={14} color="#64748b" />
              </button>

              {profileOpen && (
                <div className="dropdown-menu-popover">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-light)" }}>
                    <strong style={{ fontSize: 13, display: "block", color: "#0f172a" }}>
                      {fullName}
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {user?.email ?? "admin@abc.test"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/administration");
                    }}
                  >
                    <Settings2 size={16} />
                    <span>System Administration</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => {
                      setProfileOpen(false);
                      setHelpOpen(true);
                    }}
                  >
                    <HelpCircle size={16} />
                    <span>Support & Documentation</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-menu-item danger"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Global Search Modal (⌘K) */}
      {searchOpen && (
        <div className="modal-scrim" onClick={() => setSearchOpen(false)}>
          <div
            className="modal-dialog search-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-modal-input-wrap">
              <Search size={18} color="#64748b" />
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students, staff, subjects, or modules..."
              />
              <kbd style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                ESC
              </kbd>
            </div>

            <div className="search-results-list">
              {searchResults.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  No matching records or modules found.
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={`${item.category}-${item.title}`}
                    type="button"
                    className="search-result-item"
                    onClick={() => {
                      navigate(item.path);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>{item.title}</strong>
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                        · {item.category}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--burgundy)" }}>Jump →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {helpOpen && (
        <div className="modal-scrim" onClick={() => setHelpOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adorable British College MIS · Help & Support</h2>
              <button className="icon-button" onClick={() => setHelpOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Welcome to the Adorable British College Management Information System (MIS).
                This platform provides authoritative records for British curriculum learners,
                enrolment, attendance, pastoral care, timetable, and examinations.
              </p>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Keyboard Shortcuts</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 12.5 }}>
                  <span>Open Global Search</span>
                  <kbd style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>⌘ K / Ctrl+K</kbd>
                  <span>Close active modal or menu</span>
                  <kbd style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>ESC</kbd>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>College ICT Support</h3>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                  For technical assistance, user account permission adjustments, or report template modifications,
                  contact the college ICT Helpdesk at <strong>ict.support@adorablebritishcollege.com</strong>.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-button" onClick={() => setHelpOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
