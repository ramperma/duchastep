import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { API_URL } from '../config';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await axios.post(`${API_URL}/api/login`, { username, password });
            // Save token
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));

            // Redirect based on role
            const user = res.data.user;
            const isAdmin = user.role === 'admin' || user.role_name === 'admin';
            navigate(isAdmin ? '/admin' : '/');
        } catch (err) {
            setError('Usuario o contraseña incorrectos');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Iniciar Sesión</h1>
                    <p className="text-gray-500 text-sm">Acceso al Panel de Administración</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                        <div className="relative">
                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="password"
                                required
                                className="block w-full pl-10 border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                    >
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
