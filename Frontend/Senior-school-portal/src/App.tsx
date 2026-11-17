
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


function App() {

  return (
    <Routes>
      <Route path="/Register/Learner" element={<RegisterLearner/>}/>
        <Route path="/Register/Teacher" element={<RegisterTeacher/>}/>
        <Route path="Hoi/Dashboard" element={<HoiDashboard/>}/>
        <Route path="Teacher/Dashboard" element={<TeacherDashboard/>}/>
        <Route path="Learner/Dashboard" element={<LearnerDashboard/>}/>
        <Route path="Finances/Dashboard" element={<FinanceDashboard/>}/>
        <Route path="add/Subjects" element={<AddSubject/>}/>
        <Route path="Results/Upload/Results" element={<UploadResults/>}/>
        <Route path="Results/View/Results" element={<ViewResults/>}/>
        <Route path="/auth/Login" element={<Login/>}/>
        <Route path="Academics/Results" element={<AcademicResults/>}/>
        <Route path="Academic/LearningMaterials" element={<LearningMaterials/>}/>
        <Route path="Academic/Timetable" element={<Timetable/>}/>
        <Route path="Finance/PayFees" element={<PayFees/>}/>
        <Route path="/Finance/Fee/Structure" element={<FeeStructure/>}/>
        <Route path="/Finance/Fee/statement" element={<FeeStatements/>}/>
         <Route path="/CareerPathways" element={<PathwayRecommender/>}/>
          <Route path="/Explore/Pathways" element={<Pathways/>}/>
        <Route path="/AI/Chat" element={<AiTutorPage/>}/>
        <Route path="/Students" element={<Students/>}/>
    </Routes>
  )
}

export default App
