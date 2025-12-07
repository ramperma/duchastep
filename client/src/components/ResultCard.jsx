import React from 'react';
import { MapPin, Clock, User } from 'lucide-react';

const ResultCard = ({ commercial, rank }) => {
    const { name, distance_km, duration_min } = commercial;

    // Always green for assigned commercial
    const borderColor = 'border-green-500';
    const badgeColor = 'bg-green-100 text-green-800';

    return (
        <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${borderColor} mb-4 transition-transform hover:scale-102`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                        <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">{name}</h3>
                        <p className="text-sm text-gray-500">{commercial.commercial_city}</p>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor} mt-1`}>
                            ASIGNADO
                        </div>
                    </div>
                </div>
            </div>

            {distance_km > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-4">
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
        </div>
    );
};

export default ResultCard;
