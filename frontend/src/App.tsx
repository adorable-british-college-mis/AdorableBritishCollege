import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import {
  AdmissionReviewPage,
  AdmissionsAdminPage,
} from "./features/admissions-admin/AdmissionsAdminPage";
import { AdmissionsPage } from "./features/admissions/AdmissionsPage";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { DatabaseModulePage } from "./features/modules/DatabaseModulePage";
import { StudentsPage } from "./features/students/StudentsPage";
import { AddStudentPage } from "./features/students/AddStudentPage";
import { AcademicsPage } from "./features/academics/AcademicsPage";
import { TimetablePage } from "./features/timetable/TimetablePage";
import { AttendancePage } from "./features/attendance/AttendancePage";
import { BehaviourPage } from "./features/behaviour/BehaviourPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { CommunicationPage } from "./features/communication/CommunicationPage";

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
          <Route
            path="/students/:studentId/edit"
            element={<AddStudentPage />}
          />

          {/* Admissions Pipeline */}
          <Route path="/admissions" element={<AdmissionsAdminPage />} />
          <Route
            path="/admissions/overview"
            element={<AdmissionsAdminPage />}
          />
          <Route
            path="/admissions/applications"
            element={<AdmissionsAdminPage />}
          />
          <Route path="/admissions/offers" element={<AdmissionsAdminPage />} />
          <Route
            path="/admissions/waiting-list"
            element={<AdmissionsAdminPage />}
          />
          <Route
            path="/admissions/enrolments"
            element={<AdmissionsAdminPage />}
          />
          <Route
            path="/admissions/:applicationId"
            element={<AdmissionReviewPage />}
          />

          {/* Academic & Operations Modules */}
          <Route path="/academics" element={<AcademicsPage />} />
          <Route path="/academics/:resource" element={<AcademicsPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/take-register" element={<AttendancePage />} />
          <Route path="/attendance/registers/:registerId" element={<AttendancePage />} />
          <Route path="/behaviour" element={<BehaviourPage />} />
          <Route
            path="/pastoral"
            element={<DatabaseModulePage title="Pastoral care" />}
          />
          <Route
            path="/safeguarding"
            element={<DatabaseModulePage title="Safeguarding" />}
          />
          <Route path="/send" element={<DatabaseModulePage title="SEND" />} />
          <Route
            path="/exams"
            element={<DatabaseModulePage title="Examinations" />}
          />
          <Route
            path="/reports"
            element={<ReportsPage />}
          />
          <Route
            path="/communication"
            element={<CommunicationPage />}
          />
          <Route
            path="/finance"
            element={<DatabaseModulePage title="Finance" />}
          />
          <Route
            path="/operations"
            element={<DatabaseModulePage title="Operations" />}
          />
          <Route path="/staff" element={<DatabaseModulePage title="Staff" />} />
          <Route
            path="/administration"
            element={<DatabaseModulePage title="Administration" />}
          />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
