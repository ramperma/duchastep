import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, MapPin, Save, X, RefreshCw, Pencil } from 'lucide-react';
import { API_URL } from '../config';

const Admin = () => {
    const [commercials, setCommercials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [precalcLoading, setPrecalcLoading] = useState({}); // { id: boolean }
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', address: '', zip_code: '', city: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchCommercials();
    }, []);

    const fetchCommercials = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/commercials`);
            setCommercials(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que quieres eliminar este comercial?')) return;
        try {
            await axios.delete(`${API_URL}/api/commercials/${id}`);
            fetchCommercials();
        } catch (err) {
            alert('Error al eliminar');
        }
    };

    const handlePrecalc = async (id) => {
        setPrecalcLoading(prev => ({ ...prev, [id]: true }));
        try {
            const res = await axios.post(`${API_URL}/api/commercials/${id}/precalc`);
            alert(`Rutas actualizadas: ${res.data.count}`);
        } catch (err) {
            console.error(err);
            alert('Error al recalcular');
        } finally {
            setPrecalcLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleToggleActive = async (commercial) => {
        try {
            await axios.put(`${API_URL}/api/commercials/${commercial.id}`, {
                active: !commercial.active
            });
            fetchCommercials();
        } catch (err) {
            alert('Error al actualizar');
        }
    };

    const handleEdit = (commercial) => {
        setEditingId(commercial.id);
        setFormData({
            name: commercial.name,
            address: commercial.address,
            zip_code: commercial.zip_code,
            city: commercial.city
        });
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', address: '', zip_code: '', city: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                // Update
                await axios.put(`${API_URL}/api/commercials/${editingId}`, formData);
            } else {
                // Create
                await axios.post(`${API_URL}/api/commercials`, formData);
            }
            handleCloseForm();
            fetchCommercials();
        } catch (err) {
            alert('Error al guardar comercial');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Gestión de Comerciales</h1>
                    <button
                        onClick={() => { setEditingId(null); setFormData({ name: '', address: '', zip_code: '', city: '' }); setShowForm(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Comercial
                    </button>
                </div>

                {/* Form Modal/Overlay */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">{editingId ? 'Editar Comercial' : 'Añadir Comercial'}</h2>
                                <button onClick={handleCloseForm} className="text-gray-500 hover:text-gray-700">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Código Postal</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                            value={formData.zip_code}
                                            onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    Guardar
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Ubicación</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {commercials.map((commercial) => (
                                <tr key={commercial.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{commercial.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-500 flex items-center gap-1">
                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                            <span>
                                                {commercial.address}, {commercial.city} ({commercial.zip_code})
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleActive(commercial)}
                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${commercial.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {commercial.active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePrecalc(commercial.id)}
                                                title="Recalcular Rutas"
                                                className={`text-blue-600 hover:text-blue-900 ${precalcLoading[commercial.id] ? 'animate-spin' : ''}`}
                                                disabled={precalcLoading[commercial.id]}
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(commercial)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Editar"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(commercial.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Admin;
