
import './App.css'
import {Routes,Route} from "react-router-dom"
import RegisterLearner from './Hoi/RegisterLearner'
import RegisterTeacher from './Hoi/RegisterTeacher'
import HoiDashboard from './Hoi/HoiDashboard'

function App() {

  return (
    <Routes>
      <Route path="/registerLearner" element={<RegisterLearner/>}/>
        <Route path="/registerTeacher" element={<RegisterTeacher/>}/>
        <Route path="HoiDashboard" element={<HoiDashboard/>}/>
    </Routes>
  )
}

export default App
