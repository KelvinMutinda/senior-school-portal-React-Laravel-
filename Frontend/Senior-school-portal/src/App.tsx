
import './App.css'
import {Routes,Route} from "react-router-dom"
import RegisterLearner from './Hoi/RegisterLearner'
import RegisterTeacher from './Hoi/RegisterTeacher'
import HoiDashboard from './Hoi/HoiDashboard'
import TeacherDashboard from './Teachers/TeacherDashboard'
import FinanceDashboard from './Finance/FinanceDashboard'
import LearnerDashboard from './Student/LearnerDashboard'

function App() {

  return (
    <Routes>
      <Route path="/Register/Learner" element={<RegisterLearner/>}/>
        <Route path="/Register/Teacher" element={<RegisterTeacher/>}/>
        <Route path="Hoi/Dashboard" element={<HoiDashboard/>}/>
        <Route path="Teacher/Dashboard" element={<TeacherDashboard/>}/>
        <Route path="Learner/Dashboard" element={<LearnerDashboard/>}/>
        <Route path="Finances/Dashboard" element={<FinanceDashboard/>}/>
    </Routes>
  )
}

export default App
