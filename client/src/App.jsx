import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Search from './pages/Search';
import Admin from './pages/Admin';
import Users from './pages/Users';
import Config from './pages/Config';
import Login from './pages/Login';
import Zips from './pages/Zips';
import Layout from './components/Layout';
import './App.css'

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          } />
          <Route path="/admin/zips" element={
            <PrivateRoute>
              <Zips />
            </PrivateRoute>
          } />
          <Route path="/admin/users" element={
            <PrivateRoute>
              <Users />
            </PrivateRoute>
          } />
          <Route path="/admin/config" element={
            <PrivateRoute>
              <Config />
            </PrivateRoute>
          } />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App;
