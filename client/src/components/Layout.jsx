import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Users, LogOut, LogIn, Shield, Settings, MapPin, Calendar } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const Layout = ({ children }) => {
    // ... no changes here ...
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize user state from localStorage
    // Get user from localStorage
    // We parse it every render to ensure it's up to date after login/logout
    // since Layout doesn't unmount between route changes
    let user = null;
    try {
        const userStr = localStorage.getItem('user');
        user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error('Error parsing user from localStorage', e);
    }

    const token = localStorage.getItem('token');
    const [logoUrl, setLogoUrl] = useState(null);

    useEffect(() => {
        const fetchLogo = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/logo`);
                if (res.data.url) setLogoUrl(res.data.url);
            } catch (err) {
                console.error(err);
            }
        };
        fetchLogo();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    // If on login page, don't show layout (full screen login)
    if (location.pathname === '/login') return children;

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md flex flex-col fixed h-full z-10">
                <div className="p-6 border-b flex justify-center">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-h-12 max-w-full object-contain" />
                    ) : (
                        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                            Duchastep
                        </h1>
                    )}
                </div>

                {(user || token) ? (
                    <div className="px-6 pt-4 flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-600">
                            Hola, {user?.username || 'Usuario'}
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Cerrar Sesión"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="p-4 bg-blue-50/50 border-b">
                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                        >
                            <LogIn className="w-4 h-4" />
                            Iniciar Sesión
                        </Link>
                    </div>
                )}

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <Link
                        to="/"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Search className="w-5 h-5" />
                        Buscador
                    </Link>

                    {/* Show Calendar Link for Logged In users */}
                    {(user || token) && (
                        <Link
                            to="/calendar"
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/calendar' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Calendar className="w-5 h-5" />
                            Calendario
                        </Link>
                    )}

                    {/* Only show Admin link if user is admin */}

                    {(user?.role === 'admin' || user?.role_name === 'admin') && (
                        <>
                            <Link
                                to="/admin"
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/admin' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Users className="w-5 h-5" />
                                Comerciales
                            </Link>

                            <Link
                                to="/admin/zips"
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/admin/zips' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <MapPin className="w-5 h-5" />
                                Zonas (CPs)
                            </Link>

                            <Link
                                to="/admin/users"
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/admin/users' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Shield className="w-5 h-5" />
                                Usuarios y Roles
                            </Link>

                            <Link
                                to="/admin/config"
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/admin/config' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Settings className="w-5 h-5" />
                                Configuración
                            </Link>
                        </>
                    )}
                </nav>


            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 ml-64">
                <main className="p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
