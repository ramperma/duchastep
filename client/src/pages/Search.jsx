import React, { useState } from 'react';
import axios from 'axios';
import { Search as SearchIcon, AlertCircle } from 'lucide-react';
import ResultCard from '../components/ResultCard';
import { API_URL } from '../config';

const Search = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResults(null);

        try {
            // Call backend API
            const response = await axios.post(`${API_URL}/api/search`, { query });
            setResults(response.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Error al buscar. Por favor, verifica el código postal.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Verificador de Visitas</h1>
                    <p className="text-gray-500 mt-2 text-sm md:text-base">Introduce el Código Postal o la dirección del cliente.</p>
                </div>

                {/* Search Box */}
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6 md:mb-8">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 md:gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ej: 46001 o Calle Mayor 15, Valencia"
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base md:text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            autoFocus
                        />
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
                            {results.geocoded && (
                                <p className="mt-2 text-sm opacity-75">📍 {results.geocoded.address} (CP: {results.geocoded.postalCode})</p>
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
                                                                zip_code: query,
                                                                city: 'Valencia',
                                                                client_name: extraDetails.clientName,
                                                                address: extraDetails.address,
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
