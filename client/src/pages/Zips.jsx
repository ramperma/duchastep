import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, MapPin, Search as SearchIcon, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const Zips = () => {
    const [zips, setZips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [total, setTotal] = useState(0);
    const [sortField, setSortField] = useState('code');
    const [sortOrder, setSortOrder] = useState('ASC');

    const [formData, setFormData] = useState({ code: '', city: '' });
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null); // { type: 'success'|'error', text: '' }
    const [precalcLoading, setPrecalcLoading] = useState({}); // { code: boolean }

    useEffect(() => {
        setPage(1); // Reset to page 1 on search
    }, [search]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchZips();
        }, 500); // 500ms debounce
        return () => clearTimeout(timeoutId);
    }, [search, page, sortField, sortOrder]);

    // Clear notification after 5 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchZips = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/zips`, {
                params: { search, page, limit, sortBy: sortField, order: sortOrder }
            });
            // Handle new paginated structure
            // Backward compatibility if API wasn't updated yet (just in case)
            if (Array.isArray(res.data)) {
                setZips(res.data);
                setTotal(res.data.length);
            } else {
                setZips(res.data.data);
                setTotal(res.data.total);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortField(field);
            setSortOrder('ASC');
        }
    };

    const handleToggleViable = async (zip) => {
        try {
            const res = await axios.put(`${API_URL}/api/zips/${zip.code}`, {
                viable: !zip.viable
            });
            // Update local state optimistic or fetch
            setZips(zips.map(z => z.code === zip.code ? res.data : z));
        } catch (err) {
            setNotification({ type: 'error', text: 'Error al actualizar estado' });
        }
    };

    const handlePrecalc = async (code) => {
        setPrecalcLoading(prev => ({ ...prev, [code]: true }));
        setNotification(null);
        try {
            const res = await axios.post(`${API_URL}/api/zips/${code}/precalc`);
            setNotification({ type: 'success', text: `Rutas actualizadas: ${res.data.count}` });
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', text: 'Error al recalcular rutas' });
        } finally {
            setPrecalcLoading(prev => ({ ...prev, [code]: false }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setNotification(null);
        try {
            const res = await axios.post(`${API_URL}/api/zips`, formData);
            setNotification({ type: 'success', text: res.data.message });
            setShowForm(false);
            setFormData({ code: '', city: '' });
            fetchZips();
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', text: 'Error al crear CP (revise consola)' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Códigos Postales</h1>
                    <button
                        onClick={() => { setShowForm(true); setNotification(null); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo CP
                    </button>
                </div>

                {/* Notification Banner */}
                {notification && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        <div className="flex items-center gap-2">
                            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            <span className="font-medium">{notification.text}</span>
                        </div>
                        <button onClick={() => setNotification(null)} className="hover:opacity-75">
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar por CP o Ciudad..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">Añadir Nuevo CP</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Código Postal</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        maxLength={5}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Ciudad / Población</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg">
                                    💡 Al guardar, se calcularán automáticamente las rutas con todos los comerciales activos.
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        disabled={saving}
                                    >
                                        {saving ? 'Guardando y Calculando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('code')}
                                >
                                    CP {sortField === 'code' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('city')}
                                >
                                    Ciudad {sortField === 'city' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('viable')}
                                >
                                    Estado {sortField === 'viable' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {zips.map((zip) => (
                                <tr key={zip.code}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                        {zip.code}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                        {zip.city}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleViable(zip)}
                                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${zip.viable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                        >
                                            {zip.viable ? (
                                                <><CheckCircle className="w-3 h-3" /> Viable</>
                                            ) : (
                                                <><XCircle className="w-3 h-3" /> No Viable</>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePrecalc(zip.code)}
                                                title="Recalcular Rutas (Actualizar caché)"
                                                className={`text-blue-600 hover:text-blue-900 ${precalcLoading[zip.code] ? 'animate-spin' : ''}`}
                                                disabled={precalcLoading[zip.code]}
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {zips.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No se encontraron códigos postales.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <div className="bg-gray-50 px-4 md:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Mostrando {zips.length} de {total}</span>
                            <select
                                value={limit}
                                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                className="border-gray-300 border rounded text-sm p-1"
                            >
                                <option value={25}>25 por página</option>
                                <option value={50}>50 por página</option>
                                <option value={100}>100 por página</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1 text-sm font-medium">Página {page}</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= total}
                                className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Zips;
