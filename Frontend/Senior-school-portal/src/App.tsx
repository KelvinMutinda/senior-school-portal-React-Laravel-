import './App.css'
import { Navigate, Route, Routes } from "react-router-dom"
import RegisterLearner from './Hoi/RegisterLearner'
import RegisterTeacher from './Hoi/RegisterTeacher'
import HoiDashboard from './Hoi/HoiDashboard'
import TeacherDashboard from './Teachers/TeacherDashboard'
import FinanceDashboard from './Finance/FinanceDashboard'
import LearnerDashboard from './Student/LearnerDashboard'
import AddSubject from './components/Subjects'
import ViewResults from './components/ViewResults'
import UploadResults from './components/UploadResults'
import Login from './auth/Login'
import AiTutorPage from './AI-Models/AItutor'
import Students from './Hoi/Students'
import AcademicResults from './Student/AcademicResults'
import LearningMaterials from './Student/LearningMaterials'
import Timetable from './Student/Timetable'
import PayFees from './Student/Finance/PayFees'
import FeeStructure from './Student/Finance/FeeStructure'
import FeeStatements from './Student/Finance/FeeStatements'
import PathwayRecommender from './Student/CareerPathways/PathwayRecommender'
import Pathways from './Student/CareerPathways/Pathways'
import AcademicOverview from './Hoi/AcademicOverview'
import FinanceReports from './Hoi/Finances/FinanceReports'
import HoiFees from './Hoi/Finances/Fee'
import HoiPayments from './Hoi/Finances/Payments'
import HoiFinances from './Hoi/Finances'
import AiInsights from './Hoi/AI/AiInsights'
import AiControl from './Hoi/AI/AiControl'
import ProgressRecords from './Teachers/ProgressRecords'
import GetLearningMaterial from './Teachers/LearningMaterials/GetLearningMaterial'
import Classes from './Teachers/Classes'
import Attendance from './Teachers/Attendance'
import Timetables from './Teachers/Timetable'
import UploadLearningMaterial from './Teachers/LearningMaterials/UploadLearningMaterial'
import Announcements from './Teachers/Annoucements'
import AuditLog from './Hoi/AuditLog'
import Approval from './Hoi/Approval'
import { Toaster } from './components/Toast'
import ChangePasswordPage from './auth/ChangePasswordPage'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { getUser } from './api/authApi'
import type { PortalRole } from './api/authApi'
import LearnerPage from "./pages/learner/LearnerPage";
import Profile from "./Student/Profile";
import TeacherProfile from './Teachers/TeacherProfile'


/* Who may open what. Change a list here and every route in the group follows. */
const ADMIN: PortalRole[] = ["HOI", "DEPUTY"]
const STAFF: PortalRole[] = ["HOI", "DEPUTY", "TEACHER"]
const STUDENT: PortalRole[] = ["LEARNER", "PARENT"]
const MONEY: PortalRole[] = ["HOI", "DEPUTY", "FINANCE"]

/** /Academic/LearningMaterials was used by both the learner and teacher pages, so pick by role. */
function LearningMaterialsByRole() {
  return getUser()?.role === "LEARNER" || getUser()?.role === "PARENT" ? <LearningMaterials /> : <GetLearningMaterial />
}

function App() {
  return (
    <>
      <Toaster />
      <Routes>
        {/* ---------- Public: only for people who are signed out ---------- */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<Login />} />
          <Route path="/auth/Login" element={<Login />} />
        </Route>

        {/* ---------- Any signed-in person ---------- */}
        <Route element={<ProtectedRoute />}>
          <Route path="/auth/ChangePassword" element={<ChangePasswordPage />} />
        </Route>

        {/* ---------- Head of Institution and Deputy ---------- */}
        <Route element={<ProtectedRoute roles={ADMIN} />}>
          <Route path="/Hoi/Dashboard" element={<HoiDashboard />} />
          <Route path="/Register/Learner" element={<RegisterLearner />} />
          <Route path="/Register/Teacher" element={<RegisterTeacher />} />
          <Route path="/add/Subjects" element={<AddSubject />} />
          <Route path="/Academic/Overview" element={<AcademicOverview />} />
          <Route path="/Hoi/AI/Insights" element={<AiInsights />} />
          <Route path="/Hoi/AI/Controls" element={<AiControl />} />
          <Route path="/Hoi/Approvals" element={<Approval />} />
          <Route path="/Hoi/AuditLog" element={<AuditLog />} />
        </Route>

        {/* ---------- Finance (and the heads, who oversee it) ---------- */}
        <Route element={<ProtectedRoute roles={["FINANCE"]} />}>
          <Route path="/Finances/Dashboard" element={<FinanceDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={MONEY} />}>
          <Route path="/Finance/Reports" element={<FinanceReports />} />
          <Route path="/Hoi/Finances" element={<HoiFinances />} />
          <Route path="/Hoi/Finances/Fee" element={<HoiFees />} />
          <Route path="/Hoi/Finances/Payments" element={<HoiPayments />} />
        </Route>

        {/* ---------- Teachers (and the heads) ---------- */}
        <Route element={<ProtectedRoute roles={["TEACHER"]} />}>
          <Route path="/Teacher/Dashboard" element={<TeacherDashboard />} />
          <Route path="Teacher/Profile" element={<TeacherProfile/>}/>
        </Route>
        <Route element={<ProtectedRoute roles={STAFF} />}>
          <Route path="/Results/Upload/Results" element={<UploadResults />} />
          <Route path="/Results/View/Results" element={<ViewResults />} />
          <Route path="/Academics/Progress" element={<ProgressRecords />} />
          <Route path="/Academics/classes" element={<Classes />} />
          <Route path="/Academics/Attendance" element={<Attendance />} />
          <Route path="/Academics/Timetable" element={<Timetables />} />
          <Route path="/Upload/LearningMaterial" element={<UploadLearningMaterial />} />
          <Route path="/Teacher/materials" element={<GetLearningMaterial />} />
          <Route path="/Generate/LearningMaterial" element={<AiTutorPage />} />
          <Route path="/Announcements" element={<Announcements />} />
          <Route path="/Students" element={<Students />} />
        </Route>

        {/* ---------- Learners (and parents) ---------- */}
        <Route element={<ProtectedRoute roles={STUDENT} />}>
      
          <Route path="/Learner/Dashboard" element={<LearnerPage page="home" />} />
          <Route path="/Learner/Profile" element={<Profile />} />
          <Route path="/Academics/Results" element={<AcademicResults />} />
          <Route path="/Academic/Timetable" element={<Timetable />} />
          <Route path="/Finance/PayFees" element={<PayFees />} />
          <Route path="/Finance/Fee/Structure" element={<FeeStructure />} />
          <Route path="/Finance/Fee/statement" element={<FeeStatements />} />
          <Route path="/CareerPathways" element={<PathwayRecommender />} />
          <Route path="/Explore/Pathways" element={<Pathways />} />
          <Route path="/AI/Chat" element={<AiTutorPage />} />
        </Route>

        {/* ---------- Shared by learners and staff ---------- */}
        <Route element={<ProtectedRoute roles={[...STUDENT, ...STAFF]} />}>
          <Route path="/Academic/LearningMaterials" element={<LearningMaterialsByRole />} />
        </Route>

        {/* Anything else goes to the front door; the guards send people on from there. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App