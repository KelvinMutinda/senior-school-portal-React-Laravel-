import './App.css'
import {Routes,Route} from "react-router-dom"
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
import Profile from './Student/Profile'
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
import LoginPage from './auth/Login'
import AuditLog from './Hoi/AuditLog'
import Approval from './Hoi/Approval'
import { Toaster } from './components/Toast'



function App() {

  return (
    <>
     <Toaster />
    <Routes>
     
      <Route path="/Register/Learner" element={<RegisterLearner/>}/>
        <Route path="/Register/Teacher" element={<RegisterTeacher/>}/>
        <Route path="/Hoi/Dashboard" element={<HoiDashboard/>}/>
        <Route path="/Teacher/Dashboard" element={<TeacherDashboard/>}/>
        <Route path="/Learner/Dashboard" element={<LearnerDashboard/>}/>
        <Route path="/Finances/Dashboard" element={<FinanceDashboard/>}/>
        <Route path="/add/Subjects" element={<AddSubject/>}/>
        <Route path="/Results/Upload/Results" element={<UploadResults/>}/>
        <Route path="/Results/View/Results" element={<ViewResults/>}/>
        <Route path="/auth/Login" element={<Login/>}/>
        <Route path="/Academics/Results" element={<AcademicResults/>}/>
         <Route path="/Academics/Progress" element={<ProgressRecords/>}/>
        <Route path="/Academic/LearningMaterials" element={<LearningMaterials/>}/>
        <Route path="Academic/Timetable" element={<Timetable/>}/>
        <Route path="/Academic/Overview" element={<AcademicOverview/>}/>
        <Route path="/Finance/PayFees" element={<PayFees/>}/>
        <Route path="/Finance/Fee/Structure" element={<FeeStructure/>}/>
        <Route path="/Finance/Fee/statement" element={<FeeStatements/>}/>
        <Route path="/Finance/Reports" element={<FinanceReports/>}/>
        <Route path="/Hoi/Finances" element={<HoiFinances/>}/>
        <Route path="/Hoi/Finances/Fee" element={<HoiFees/>}/>
        <Route path="/Hoi/Finances/Payments" element={<HoiPayments/>}/>
        <Route path="/CareerPathways" element={<PathwayRecommender/>}/>
        <Route path="/Explore/Pathways" element={<Pathways/>}/>
        <Route path="/AI/Chat" element={<AiTutorPage/>}/>
        <Route path="/Students" element={<Students/>}/>
        <Route path="Hoi/AI/Insights" element={<AiInsights/>}/>
        <Route path="Hoi/AI/Controls" element={<AiControl/>}/>
        <Route path="/Learner/Profile"element={<Profile/>}/>
        <Route path="/Upload/LearningMaterial" element={<UploadLearningMaterial/>}/>
        <Route path="/Academic/LearningMaterials" element={<GetLearningMaterial/>}/>
        <Route path="/Generate/LearningMaterial" element={<AiTutorPage/>}/>
        <Route path="/Academics/classes" element={<Classes/>}/>
        <Route path="/Academics/Attendance" element={<Attendance/>}/>
        <Route path="/Academics/Timetable" element={<Timetables/>}/>
        <Route path="/Teacher/materials" element={<GetLearningMaterial/>}/>
        <Route path="/Announcements" element={<Announcements/>}/>
        <Route path="/" element={<LoginPage/>}/>
        <Route path="/Hoi/Approvals" element={<Approval/>}/>
        <Route path="/Hoi/Audit" element={<AuditLog/>}/>


    </Routes>
    </>
  )
}

export default App