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

function App() {
  return (
    <Router>
      <AxiosInterceptor>
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
            <Route path="/calendar" element={
              <PrivateRoute>
                <CalendarPage />
              </PrivateRoute>
            } />
          </Routes>
        </Layout>
      </AxiosInterceptor>
    </Router>
  )
}

export default App;
