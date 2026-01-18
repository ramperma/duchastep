import React from 'react';
import { MapPin, Clock, User } from 'lucide-react';

const ResultCard = ({ commercial, rank, closeThreshold = 15 }) => {
    const { name, distance_km, duration_min } = commercial;

    // Color based on time: duration <= closeThreshold = green, else orange/red
    // Label based on rank: 1st, 2nd, 3rd, etc.
    const getRankStyle = () => {
        // Determine color based on time threshold
        let colorStyle;
        if (duration_min <= closeThreshold) {
            colorStyle = {
                border: 'border-green-500',
                badge: 'bg-green-100 text-green-800'
            };
        } else if (duration_min <= closeThreshold * 2) {
            colorStyle = {
                border: 'border-orange-500',
                badge: 'bg-orange-100 text-orange-800'
            };
        } else {
            colorStyle = {
                border: 'border-red-500',
                badge: 'bg-red-100 text-red-800'
            };
        }

        // Determine label based on rank
        let label;
        switch (rank) {
            case 1:
                label = '🥇 Más cercano';
                break;
            case 2:
                label = '🥈 2º más cercano';
                break;
            case 3:
                label = '🥉 3º más cercano';
                break;
            default:
                label = `${rank}º comercial`;
        }

        return { ...colorStyle, label };
    };

    const rankStyle = getRankStyle();

    const [showCalendarModal, setShowCalendarModal] = React.useState(false);
    const [appointmentDate, setAppointmentDate] = React.useState('');
    const [clientName, setClientName] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [observations, setObservations] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleBookAppointment = async () => {
        if (!appointmentDate) return alert('Por favor selecciona una fecha y hora');

        setLoading(true);
        try {
            // Handled by parent's onBook callback
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${rankStyle.border} mb-4 transition-transform hover:scale-102`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{name}</h3>
                            <p className="text-sm text-gray-500">{commercial.commercial_city}</p>
                            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rankStyle.badge} mt-1`}>
                                {rankStyle.label}
                                {commercial.precise && <span className="ml-1">📍</span>}
                            </div>
                        </div>
                    </div>
                </div>


                {distance_km > 0 && (
                    <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{distance_km} km</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{duration_min} min</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setShowCalendarModal(true)}
                    className="w-full mt-2 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors"
                >
                    <Clock className="w-4 h-4" />
                    Agendar Cita
                </button>
            </div>

            {/* Modal */}
            {showCalendarModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Agendar Cita con {name}</h3>

                        <div className="space-y-4">
                            {/* Client Name */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Nombre del Cliente</label>
                                <input
                                    id="nameInput"
                                    type="text"
                                    placeholder="Nombre Apellido"
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('dateInput')?.focus()}
                                    autoFocus
                                />
                            </div>

                            {/* Date & Time Split for better navigation */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                                <input
                                    id="dateInput"
                                    type="date"
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={appointmentDate.split('T')[0] || ''}
                                    onChange={(e) => {
                                        const time = appointmentDate.split('T')[1] || '09:00';
                                        setAppointmentDate(`${e.target.value}T${time}`);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('timeInput')?.focus()}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Hora</label>
                                <input
                                    id="timeInput"
                                    type="time"
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={appointmentDate.split('T')[1] || ''}
                                    onChange={(e) => {
                                        const date = appointmentDate.split('T')[0] || new Date().toISOString().split('T')[0];
                                        setAppointmentDate(`${date}T${e.target.value}`);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('addressInput')?.focus()}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Dirección (Ubicación)</label>
                                <input
                                    id="addressInput"
                                    type="text"
                                    placeholder="Calle, Número, Población..."
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('obsInput')?.focus()}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Observaciones (Opcional)</label>
                                <textarea
                                    id="obsInput"
                                    placeholder="Notas adicionales..."
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="2"
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            document.getElementById('confirmBtn')?.click();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCalendarModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancelar
                            </button>
                            <button
                                id="confirmBtn"
                                onClick={() => {
                                    // Call parent handler with extra details
                                    if (commercial.onBook) {
                                        commercial.onBook(commercial.id, appointmentDate, {
                                            clientName,
                                            address,
                                            observations
                                        });
                                    }
                                    setShowCalendarModal(false);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ResultCard;
