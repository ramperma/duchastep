import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search as SearchIcon, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import ResultCard from '../components/ResultCard';
import { API_URL } from '../config';

// Generar UUID para sessionToken
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Hook para debounce
const useDebouncedValue = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
};

const Search = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    // Nuevo estado para autocompletado
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [sessionToken, setSessionToken] = useState(generateUUID());

    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Configuración dinámica
    const [config, setConfig] = useState({
        debounceMs: 600,
        minChars: 5
    });

    // Cargar configuración al montar
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/settings`);
                setConfig({
                    debounceMs: parseInt(res.data.autocomplete_debounce_ms) || 600,
                    minChars: parseInt(res.data.autocomplete_min_chars) || 5
                });
            } catch (err) {
                console.error('Error cargando config de búsqueda:', err);
            }
        };
        fetchConfig();
    }, []);

    // Debounce dinámico basado en la config cargada
    const debouncedQuery = useDebouncedValue(query, config.debounceMs);

    // Throttle: evitar más de 1 llamada por segundo
    const lastCallRef = useRef(0);

    // Cerrar sugerencias al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Llamar a autocomplete cuando cambia el query (con debounce)
    useEffect(() => {
        const fetchSuggestions = async () => {
            // No buscar si ya hay un lugar seleccionado o query muy corto
            if (selectedPlace) return;

            // Contar solo caracteres alfanuméricos
            const alphanumCount = (debouncedQuery.match(/[a-zA-Z0-9]/g) || []).length;
            if (alphanumCount < config.minChars) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            // Throttle: mínimo 1 segundo entre llamadas
            const now = Date.now();
            if (now - lastCallRef.current < 1000) return;
            lastCallRef.current = now;

            setLoadingSuggestions(true);
            try {
                const res = await axios.post(`${API_URL}/api/autocomplete`, {
                    input: debouncedQuery,
                    sessionToken
                });

                if (res.data.suggestions && res.data.suggestions.length > 0) {
                    setSuggestions(res.data.suggestions);
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch (err) {
                console.error('Error en autocomplete:', err);
                setSuggestions([]);
            } finally {
                setLoadingSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQuery, sessionToken, selectedPlace]);

    // Seleccionar una sugerencia
    const handleSelectSuggestion = async (suggestion) => {
        setShowSuggestions(false);
        setQuery(suggestion.description);
        setLoadingSuggestions(true);
        setError('');

        try {
            // Obtener detalles del lugar (cierra sesión de Places)
            const detailsRes = await axios.post(`${API_URL}/api/place-details`, {
                placeId: suggestion.placeId,
                sessionToken
            });

            if (detailsRes.data.lat && detailsRes.data.lng) {
                setSelectedPlace(detailsRes.data);

                // Generar nuevo sessionToken para próximas búsquedas
                setSessionToken(generateUUID());

                // Llamar al ranking automáticamente
                await fetchRanking(detailsRes.data);
            } else {
                setError('No se pudieron obtener las coordenadas de la dirección');
            }
        } catch (err) {
            console.error('Error obteniendo detalles:', err);
            setError('Error al procesar la dirección seleccionada');
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Obtener ranking de comerciales
    const fetchRanking = async (placeDetails) => {
        setLoading(true);
        setResults(null);
        setError('');

        try {
            const res = await axios.post(`${API_URL}/api/ranking`, {
                lat: placeDetails.lat,
                lng: placeDetails.lng,
                formattedAddress: placeDetails.formattedAddress
            });
            setResults(res.data);
        } catch (err) {
            console.error('Error en ranking:', err);
            setError(err.response?.data?.error || 'Error al calcular comerciales cercanos');
        } finally {
            setLoading(false);
        }
    };

    // Búsqueda manual (botón o Enter) - fallback al sistema antiguo para CPs
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        // Si ya hay un lugar seleccionado, usar ese
        if (selectedPlace) {
            await fetchRanking(selectedPlace);
            return;
        }

        // Si es un código postal (5 dígitos), usar el sistema antiguo
        const isPostalCode = /^\d{5}$/.test(query.trim());
        if (isPostalCode) {
            setLoading(true);
            setError('');
            setResults(null);

            try {
                const response = await axios.post(`${API_URL}/api/search`, { query });
                setResults(response.data);
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.error || 'Error al buscar. Por favor, verifica el código postal.');
            } finally {
                setLoading(false);
            }
            return;
        }

        // Si no es CP y no hay sugerencias, mostrar mensaje
        setError('Por favor, selecciona una dirección de las sugerencias o introduce un código postal (5 dígitos)');
    };

    // Limpiar selección cuando el usuario edita el texto
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setQuery(newValue);

        // Si el usuario edita después de seleccionar, limpiar selección
        if (selectedPlace && newValue !== selectedPlace.formattedAddress) {
            setSelectedPlace(null);
            setResults(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Verificador de Visitas</h1>
                    <p className="text-gray-500 mt-2 text-sm md:text-base">Escribe la dirección del cliente para ver sugerencias</p>
                </div>

                {/* Search Box con Autocompletado */}
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6 md:mb-8">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 md:gap-2">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={handleInputChange}
                                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                placeholder="Ej: Calle Mayor 15, Valencia"
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base md:text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                                autoComplete="off"
                            />
                            {loadingSuggestions && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                            )}
                            {selectedPlace && !loadingSuggestions && (
                                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                            )}

                            {/* Dropdown de sugerencias */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div
                                    ref={suggestionsRef}
                                    className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                                >
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={s.placeId || i}
                                            type="button"
                                            onClick={() => handleSelectSuggestion(s)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-start gap-3 border-b last:border-b-0 transition-colors"
                                        >
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="font-medium text-gray-900">{s.mainText || s.description}</div>
                                                {s.secondaryText && (
                                                    <div className="text-sm text-gray-500">{s.secondaryText}</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                    <div className="px-4 py-2 text-xs text-gray-400 text-center bg-gray-50">
                                        Powered by Google
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Buscando...' : (
                                <>
                                    <SearchIcon className="w-5 h-5" />
                                    BUSCAR
                                </>
                            )}
                        </button>
                    </form>

                    {/* Indicador de dirección seleccionada */}
                    {selectedPlace && (
                        <div className="mt-3 text-sm text-green-600 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>Dirección verificada: {selectedPlace.formattedAddress}</span>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="animate-fade-in">
                        {/* Viability Status */}
                        <div className={`p-4 rounded-lg mb-6 text-center ${results.viable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            <h2 className="text-2xl font-bold">
                                {results.viable ? '✅ CLIENTE VIABLE' : '❌ CLIENTE NO VIABLE'}
                            </h2>
                            <p className="mt-1 font-medium">{results.message}</p>
                            {results.geocoded && results.geocoded.address && (
                                <p className="mt-2 text-sm opacity-75">📍 {results.geocoded.address}</p>
                            )}
                        </div>

                        {/* Commercials List */}
                        {results.results && results.results.length > 0 && (
                            <>
                                <h3 className="text-gray-700 font-semibold mb-4">Comerciales más cercanos:</h3>
                                <div className="space-y-4">
                                    {results.results.map((commercial, index) => (
                                        <ResultCard
                                            key={commercial.id}
                                            commercial={{
                                                ...commercial,
                                                onBook: async (commId, date, extraDetails = {}) => {
                                                    try {
                                                        const res = await axios.post(`${API_URL}/api/appointments`, {
                                                            commercial_id: commId,
                                                            client_data: {
                                                                zip_code: selectedPlace?.postalCode || query,
                                                                city: 'Valencia',
                                                                client_name: extraDetails.clientName,
                                                                address: selectedPlace?.formattedAddress || extraDetails.address,
                                                                observations: extraDetails.observations
                                                            },
                                                            appointment_date: date
                                                        });

                                                        if (res.data.success) {
                                                            alert('✅ Cita agendada correctamente en Google Calendar');
                                                            window.open(res.data.link, '_blank');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('❌ Error al agendar: ' + (err.response?.data?.error || err.message));
                                                    }
                                                }
                                            }}
                                            rank={index + 1}
                                            closeThreshold={results.closeThresholdMinutes || 15}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Search;
