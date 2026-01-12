import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Users, LogOut, LogIn, Shield, Settings, MapPin, Calendar, Menu, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const Layout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Initialize user state from localStorage
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

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    // If on login page, don't show layout (full screen login)
    if (location.pathname === '/login') return children;

    const NavLinks = () => (
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Link
                to="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
            >
                <Search className="w-5 h-5" />
                Buscador
            </Link>

            {/* Calendar Link (TEMPORARILY DISABLED) */}
            {(user || token) && (
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed opacity-50"
                    title="Módulo desactivado temporalmente"
                >
                    <Calendar className="w-5 h-5" />
                    <span>Calendario</span>
                    <span className="text-[10px] bg-gray-100 px-1 rounded ml-auto">Próx.</span>
                </div>
            )}

            {/* Admin links */}
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
                        Usuarios
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
    );

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ===== MOBILE HEADER ===== */}
            <header className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    aria-label="Abrir menú"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
                <div className="flex-1 flex justify-center">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-h-8 object-contain" />
                    ) : (
                        <span className="text-lg font-bold text-blue-600">Duchastep</span>
                    )}
                </div>
                <div className="w-10" /> {/* Spacer */}
            </header>

            {/* ===== MOBILE MENU OVERLAY ===== */}
            <div
                className={`lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setMobileMenuOpen(false)}
            />

            {/* ===== MOBILE SIDEBAR (Slide-in) ===== */}
            <aside
                className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-h-10 object-contain" />
                    ) : (
                        <span className="text-xl font-bold text-blue-600">Duchastep</span>
                    )}
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {(user || token) && (
                    <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
                        <span className="text-sm font-medium text-gray-600">
                            Hola, {user?.username || 'Usuario'}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {!(user || token) && (
                    <div className="p-4 border-b">
                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                        >
                            <LogIn className="w-4 h-4" />
                            Iniciar Sesión
                        </Link>
                    </div>
                )}

                <NavLinks />
            </aside>

            {/* ===== DESKTOP SIDEBAR (Fixed) ===== */}
            <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-full w-64 bg-white shadow-md z-10">
                <div className="p-6 border-b flex justify-center">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-h-12 max-w-full object-contain" />
                    ) : (
                        <h1 className="text-2xl font-bold text-blue-600">Duchastep</h1>
                    )}
                </div>

                {(user || token) ? (
                    <div className="px-6 py-4 flex items-center justify-between border-b">
                        <span className="text-sm font-medium text-gray-600">
                            Hola, {user?.username || 'Usuario'}
                        </span>
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

                <NavLinks />
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <div className="lg:ml-64">
                <main className="p-4 lg:p-8 pt-20 lg:pt-8 min-h-screen">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
