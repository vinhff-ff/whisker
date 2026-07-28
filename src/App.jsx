import { Routes, Route } from 'react-router-dom'
import './style/index.scss'
import Home from './page/home'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

export default App
