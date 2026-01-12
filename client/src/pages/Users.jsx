import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit, User, Shield } from 'lucide-react';
import { API_URL } from '../config';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ username: '', password: '', role_id: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/users`);
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/roles`);
            setRoles(res.data);
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, role_id: res.data[0].id }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.put(`${API_URL}/api/users/${editingId}`, formData);
            } else {
                await axios.post(`${API_URL}/api/users`, formData);
            }
            setShowModal(false);
            setEditingId(null);
            setFormData({ username: '', password: '', role_id: roles[0]?.id || '' });
            fetchUsers();
        } catch (err) {
            alert('Error al guardar usuario');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que quieres eliminar este usuario?')) {
            try {
                await axios.delete(`${API_URL}/api/users/${id}`);
                fetchUsers();
            } catch (err) {
                alert('Error al eliminar');
            }
        }
    };

    const handleEdit = (user) => {
        setEditingId(user.id);
        setFormData({ username: user.username, password: '', role_id: user.role_id });
        setShowModal(true);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
                    <p className="text-gray-500 text-sm md:text-base">Administra el acceso y los roles del sistema.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ username: '', password: '', role_id: roles[0]?.id || '' });
                        setShowModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Usuario
                </button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Usuario</th>
                            <th className="p-4 font-semibold text-gray-600">Rol</th>
                            <th className="p-4 font-semibold text-gray-600">Fecha Creación</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="p-4 flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-full">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <span className="font-medium">{user.username}</span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role_name === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        <Shield className="w-3 h-3" />
                                        {user.role_name}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500 text-sm">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                    >
                                        <Edit className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">
                            {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border rounded-lg p-2"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Contraseña {editingId && '(Dejar en blanco para no cambiar)'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingId}
                                    className="w-full border rounded-lg p-2"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select
                                    className="w-full border rounded-lg p-2"
                                    value={formData.role_id}
                                    onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                                >
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
