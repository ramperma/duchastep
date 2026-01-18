import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Save, Image as ImageIcon, MapPin, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const Config = () => {
    const [logoUrl, setLogoUrl] = useState(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    const [centralAddress, setCentralAddress] = useState('');
    const [centralLimit, setCentralLimit] = useState('100');
    const [searchResultsCount, setSearchResultsCount] = useState('3');
    const [conflictThreshold, setConflictThreshold] = useState('5');
    const [closeThreshold, setCloseThreshold] = useState('15');
    const [loadingCentral, setLoadingCentral] = useState(false);

    // Precalc state
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // Get all settings
            const res = await axios.get(`${API_URL}/api/settings`);
            if (res.data.logo_url) setLogoUrl(res.data.logo_url);
            if (res.data.central_address) setCentralAddress(res.data.central_address);
            if (res.data.central_max_minutes) setCentralLimit(res.data.central_max_minutes);
            if (res.data.search_results_count) setSearchResultsCount(res.data.search_results_count);
            if (res.data.conflict_threshold_minutes) setConflictThreshold(res.data.conflict_threshold_minutes);
            if (res.data.close_threshold_minutes) setCloseThreshold(res.data.close_threshold_minutes);
        } catch (err) {
            console.error('Error fetching settings:', err);
            // Fallback for logo if settings endpoint fails (backward copatibility)
            fetchLogo();
        }
    };

    const fetchLogo = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/logo`);
            if (res.data.url) {
                setLogoUrl(res.data.url);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('logo', file);

        try {
            const res = await axios.post(`${API_URL}/api/logo`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setLogoUrl(res.data.url);
            setFile(null);
            setPreview(null);
            alert('Logo actualizado correctamente');
            // Force reload to update sidebar
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Error al subir el logo');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCentral = async () => {
        setLoadingCentral(true);
        try {
            await axios.post(`${API_URL}/api/settings`, {
                key: 'central_address',
                value: centralAddress
            });
            await axios.post(`${API_URL}/api/settings`, {
                key: 'central_max_minutes',
                value: centralLimit
            });
            await axios.post(`${API_URL}/api/settings`, {
                key: 'search_results_count',
                value: searchResultsCount
            });
            await axios.post(`${API_URL}/api/settings`, {
                key: 'conflict_threshold_minutes',
                value: conflictThreshold
            });
            await axios.post(`${API_URL}/api/settings`, {
                key: 'close_threshold_minutes',
                value: closeThreshold
            });
            alert('Configuración guardada correctamente');
        } catch (err) {
            console.error(err);
            alert('Error al guardar la dirección');
        } finally {
            setLoadingCentral(false);
        }
    };

    const handleRecalc = async () => {
        if (!window.confirm('¿Seguro que quieres recalcular TODAS las rutas? Esto puede tardar varios minutos y consumirá cuota de API.')) return;

        setProcessing(true);
        setProgress({ current: 0, total: 0 });

        // Subscribe to SSE
        const eventSource = new EventSource(`${API_URL}/api/settings/recalc/progress`);

        eventSource.onopen = () => {
            console.log("SSE Connected");
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Progress:", data);
            setProgress(data);

            if (data.current === data.total && data.total > 0) {
                // Finished
                eventSource.close();
                setProcessing(false);
                alert('Cálculo finalizado correctamente.');
            }
            // If total is 0, we might want to handle it too, but backend usually sends something on finish.
            if (data.status === 'done') { // Proposed backend change to signal explicit done
                eventSource.close();
                setProcessing(false);
                alert(data.message || 'Proceso finalizado');
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Error:", err);
            // Don't close immediately unless fatal, but for this simple implementation:
            // eventSource.close(); 
            // setProcessing(false);
        };

        // Start process
        try {
            await axios.post(`${API_URL}/api/settings/recalc`);
        } catch (err) {
            console.error(err);
            alert('Error al iniciar cálculo');
            setProcessing(false);
            eventSource.close();
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Configuración</h1>
            <p className="text-gray-500 mb-6 md:mb-8 text-sm md:text-base">Personaliza la apariencia de la aplicación.</p>

            <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    Logo de la Empresa
                </h2>

                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Current Logo / Preview */}
                    <div className="w-full md:w-1/3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Vista Previa</p>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center min-h-[200px] bg-gray-50">
                            {preview ? (
                                <img src={preview} alt="Preview" className="max-w-full h-auto max-h-40 object-contain" />
                            ) : logoUrl ? (
                                <img src={logoUrl} alt="Current Logo" className="max-w-full h-auto max-h-40 object-contain" />
                            ) : (
                                <span className="text-gray-400 text-sm">Sin logo configurado</span>
                            )}
                        </div>
                    </div>

                    {/* Upload Controls */}
                    <div className="w-full md:w-2/3 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subir nueva imagen</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2.5 file:px-4
                                    file:rounded-lg file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100
                                    transition-colors"
                            />
                            <p className="mt-1 text-xs text-gray-500">PNG, JPG o SVG (Máx. 2MB recomendado)</p>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    'Subiendo...'
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuración de Central */}
            <div className="bg-white rounded-xl shadow p-6 mt-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Ubicación de la Central
                </h2>
                <div className="max-w-xl space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dirección para cálculo de rutas (Google Maps)
                        </label>
                        <input
                            type="text"
                            value={centralAddress}
                            onChange={(e) => setCentralAddress(e.target.value)}
                            placeholder="Ej: Calle Principal 123, Valencia, España"
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Distancia máxima para viabilidad (Minutos)
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="number"
                                value={centralLimit}
                                onChange={(e) => setCentralLimit(e.target.value)}
                                placeholder="100"
                                className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                            />
                            <button
                                onClick={handleSaveCentral}
                                disabled={loadingCentral}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {loadingCentral ? 'Guardando...' : 'Guardar Todo'}
                            </button>
                        </div>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                        Si un cliente está a más de <strong>{centralLimit || 100} minutos</strong> de la central, se marcará como NO VIABLE automáticamente.
                    </p>
                </div>
            </div>

            {/* Configuración de Búsqueda */}
            <div className="bg-white rounded-xl shadow p-6 mt-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    Configuración de Búsqueda
                </h2>
                <div className="max-w-xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Número de comerciales a mostrar
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={searchResultsCount}
                            onChange={(e) => setSearchResultsCount(e.target.value)}
                            className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                        />
                        <p className="mt-1 text-xs text-gray-500">Cuántos comerciales aparecerán en el ranking de resultados (Ej: 3).</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Umbral de desempate (Minutos)
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={conflictThreshold}
                            onChange={(e) => setConflictThreshold(e.target.value)}
                            className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Si la diferencia entre comerciantes es menor a este tiempo, se usará Google Maps para desempatar con precisión de calle.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tiempo mínimo para considerar cercano (Minutos)
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={closeThreshold}
                            onChange={(e) => setCloseThreshold(e.target.value)}
                            className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Comerciales a menos de este tiempo aparecerán en <span className="text-green-600 font-semibold">verde</span>.
                            Los demás en <span className="text-orange-600 font-semibold">naranja</span> o <span className="text-red-600 font-semibold">rojo</span>.
                        </p>
                    </div>

                    <button
                        onClick={handleSaveCentral}
                        disabled={loadingCentral}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {loadingCentral ? 'Guardando...' : 'Guardar Configuración de Búsqueda'}
                    </button>
                </div>
            </div>
            {/* Precálculo de Rutas */}
            <div className="bg-white rounded-xl shadow p-6 mt-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <RefreshCw className={`w-5 h-5 text-blue-600 ${processing ? 'animate-spin' : ''}`} />
                    Precálculo de Rutas (Caché)
                </h2>
                <div className="max-w-xl">
                    <p className="text-sm text-gray-600 mb-4">
                        Esta operación calcula las distancias y tiempos entre todos los códigos postales "Viables" y tus comerciales.
                        Es necesaria para que el sistema funcione rápido sin gastar API en cada búsqueda.
                    </p>

                    {!processing ? (
                        <button
                            onClick={handleRecalc}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Iniciar Precálculo Completo
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium text-gray-700">
                                <span>Procesando...</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 text-center">No cierres esta página.</p>
                        </div>
                    )}
                </div>
            </div>

        </div >
    );
};

export default Config;
