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
            alert('Dirección de central guardada correctamente');
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

        // Start process immediately (don't wait for connection open event which might be flaky)
        try {
            await axios.post(`${API_URL}/api/settings/recalc`);
        } catch (err) {
            console.error(err);
            alert('Error al iniciar cálculo');
            setProcessing(false);
            eventSource.close();
            return;
        }

        eventSource.onopen = () => {
            console.log("SSE Connected");
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            if (data.current === data.total) {
                eventSource.close();
                setProcessing(false);
                if (data.total > 0) {
                    alert('Cálculo finalizado correctamente.');
                } else {
                    alert('No hay rutas para calcular (verifique comerciales y CPs).');
                }
            }
        };

        eventSource.onerror = () => {
            // eventSource.close(); // Don't close immediately on error, retry might happen
            // But if server dies, we should stop
        };
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración</h1>
            <p className="text-gray-500 mb-8">Personaliza la apariencia de la aplicación.</p>

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
                <div className="max-w-xl">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dirección para cálculo de rutas (Google Maps)
                    </label>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={centralAddress}
                            onChange={(e) => setCentralAddress(e.target.value)}
                            placeholder="Ej: Calle Principal 123, Valencia, España"
                            className="flex-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                        />
                        <button
                            onClick={handleSaveCentral}
                            disabled={loadingCentral}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {loadingCentral ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        Esta dirección se usará como punto de origen para calcular si el cliente está a menos de 100km.
                    </p>
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
