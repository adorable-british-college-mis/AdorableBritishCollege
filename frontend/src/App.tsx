import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdmissionReviewPage, AdmissionsAdminPage } from "./features/admissions-admin/AdmissionsAdminPage";
import { AdmissionsPage } from "./features/admissions/AdmissionsPage";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { DatabaseModulePage } from "./features/modules/DatabaseModulePage";
import { StudentsPage } from "./features/students/StudentsPage";
import { AddStudentPage } from "./features/students/AddStudentPage";

export function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<AdmissionsPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated Admin Shell Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Core MIS Modules */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/new" element={<AddStudentPage />} />

          {/* Admissions Pipeline */}
          <Route path="/admissions" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/overview" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/applications" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/offers" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/waiting-list" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/enrolments" element={<AdmissionsAdminPage />} />
          <Route path="/admissions/:applicationId" element={<AdmissionReviewPage />} />

          {/* Academic & Operations Modules */}
          <Route path="/academics" element={<DatabaseModulePage title="Academics" />} />
          <Route path="/timetable" element={<DatabaseModulePage title="Timetable" />} />
          <Route path="/attendance" element={<DatabaseModulePage title="Attendance" />} />
          <Route path="/behaviour" element={<DatabaseModulePage title="Behaviour" />} />
          <Route path="/pastoral" element={<DatabaseModulePage title="Pastoral care" />} />
          <Route path="/safeguarding" element={<DatabaseModulePage title="Safeguarding" />} />
          <Route path="/send" element={<DatabaseModulePage title="SEND" />} />
          <Route path="/exams" element={<DatabaseModulePage title="Examinations" />} />
          <Route path="/reports" element={<DatabaseModulePage title="Reports" />} />
          <Route path="/communication" element={<DatabaseModulePage title="Communication" />} />
          <Route path="/finance" element={<DatabaseModulePage title="Finance" />} />
          <Route path="/operations" element={<DatabaseModulePage title="Operations" />} />
          <Route path="/staff" element={<DatabaseModulePage title="Staff" />} />
          <Route path="/administration" element={<DatabaseModulePage title="Administration" />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
