import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import React, { useLayoutEffect } from 'react';
import Search from './pages/Search';
import Admin from './pages/Admin';
import Users from './pages/Users';
import Config from './pages/Config';
import Login from './pages/Login';
import CalendarPage from './pages/CalendarPage';
import Zips from './pages/Zips';
import Layout from './components/Layout';
import './App.css'

// Axios Interceptor Component to use useNavigate hook
const AxiosInterceptor = ({ children }) => {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          localStorage.removeItem('token');
          // Redirect to login if not already there
          if (window.location.pathname !== '/login') {
            navigate('/login');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  return children;
};

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  let user = null;
  try {
    const userStr = localStorage.getItem('user');
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error('Error parsing user', e);
  }

  const isAdmin = user?.role === 'admin' || user?.role_name === 'admin';

  if (!token) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;

  return children;
};

function App() {
  return (
    <Router>
      <AxiosInterceptor>
        <Layout>
          <Routes>
            <Route path="/" element={<Search />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } />
            <Route path="/admin/zips" element={
              <AdminRoute>
                <Zips />
              </AdminRoute>
            } />
            <Route path="/admin/users" element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            } />
            <Route path="/admin/config" element={
              <AdminRoute>
                <Config />
              </AdminRoute>
            } />
            <Route path="/calendar" element={
              <AdminRoute>
                <CalendarPage />
              </AdminRoute>
            } />
          </Routes>
        </Layout>
      </AxiosInterceptor>
    </Router>
  )
}

export default App;
