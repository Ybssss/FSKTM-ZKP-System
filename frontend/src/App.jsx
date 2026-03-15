import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layouts
import PanelLayout from "./components/layout/PanelLayout";
import StudentLayout from "./components/layout/StudentLayout";

// Auth Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Panel/Staff Pages
import PanelDashboard from "./pages/panel/PanelDashboard";
import EvaluationPage from "./pages/panel/EvaluationPage";
import EditEvaluationPage from "./pages/panel/EditEvaluationPage";
import RubricPage from "./pages/panel/RubricPage";
import UsersPage from "./pages/panel/UsersPage";
import HistoricalFeedbackPage from "./pages/panel/HistoricalFeedbackPage";
import TimetableManagementPage from "./pages/panel/TimetableManagementPage";
import SessionDetailPage from "./pages/panel/SessionDetailPage";
import PanelAssignmentPage from "./pages/panel/PanelAssignmentPage";
import PanelAttendancePage from "./pages/panel/PanelAttendancePage";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import FeedbackPage from "./pages/student/FeedbackPage";
import ProgressPage from "./pages/student/ProgressPage";
import SchedulePage from "./pages/student/SchedulePage";
import AttendancePage from "./pages/student/AttendancePage";
import StudentRubrics from "./pages/student/StudentRubrics";

// Shared Pages
import DeviceManagementPage from "./pages/DeviceManagementPage";
import StudentProfile from "./pages/student/StudentProfile";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Staff Routes (SuperAdmin, Admin, Panel, Coordinator, Supervisor) */}
          <Route
            path="/panel"
            element={
              // ✅ ADDED 'superadmin' and 'supervisor' to allowed roles
              <ProtectedRoute
                allowedRoles={[
                  "superadmin",
                  "admin",
                  "panel",
                  "coordinator",
                  "supervisor",
                ]}
              >
                <PanelLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PanelDashboard />} />
            <Route path="evaluation" element={<EvaluationPage />} />
            <Route path="evaluation/new" element={<EvaluationPage />} />{" "}
            {/* ✅ ADDED THIS LINE */}
            <Route
              path="evaluation/edit/:id"
              element={<EditEvaluationPage />}
            />
            <Route path="rubrics" element={<RubricPage />} />
            <Route
              path="historical-feedback"
              element={<HistoricalFeedbackPage />}
            />
            <Route path="sessions" element={<TimetableManagementPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="attendance" element={<PanelAttendancePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="assignments" element={<PanelAssignmentPage />} />
            {/* Shared Tools for Staff */}
            <Route path="devices" element={<DeviceManagementPage />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="evaluation" element={<FeedbackPage />} />
            <Route path="rubrics" element={<StudentRubrics />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="schedule/:id" element={<SessionDetailPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="sessions" element={<SchedulePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="devices" element={<DeviceManagementPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
