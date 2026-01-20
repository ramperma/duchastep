/**
 * Routes API - Servicio para cálculo de rutas en tiempo real
 * Documentación: https://developers.google.com/maps/documentation/routes
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_KEY;

/**
 * Calcula matriz de rutas desde múltiples orígenes a un destino
 * @param {Array} origins - Array de { lat, lng, ...metadata }
 * @param {Object} destination - { lat, lng } destino del cliente
 * @returns {Array} Resultados con duración y distancia para cada origen
 */
async function computeRouteMatrix(origins, destination) {
    if (!GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_MAPS_KEY no configurada');
        return null;
    }

    if (!origins || origins.length === 0) {
        console.error('❌ Routes: No hay orígenes');
        return [];
    }

    try {
        const requestBody = {
            origins: origins.map(o => ({
                waypoint: {
                    location: {
                        latLng: {
                            latitude: parseFloat(o.lat),
                            longitude: parseFloat(o.lng)
                        }
                    }
                }
            })),
            destinations: [{
                waypoint: {
                    location: {
                        latLng: {
                            latitude: parseFloat(destination.lat),
                            longitude: parseFloat(destination.lng)
                        }
                    }
                }
            }],
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_UNAWARE' // Sin tráfico para consistencia
        };

        const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration'
            },
            body: JSON.stringify(requestBody)
        });

        const text = await response.text();

        // Log para diagnóstico
        if (!response.ok) {
            console.error(`❌ Routes API HTTP ${response.status}: ${text.substring(0, 500)}`);
            return null;
        }

        console.log(`🛣️ [Routes] Respuesta OK (${text.length} chars)`);
        console.log(`🛣️ [Routes] Raw (primeros 500): ${text.substring(0, 500)}`);

        // La respuesta es un JSON array normal
        let results;
        try {
            results = JSON.parse(text);
            if (!Array.isArray(results)) {
                results = [results];
            }
        } catch (e) {
            console.error('❌ Error parseando respuesta Routes:', e.message);
            return null;
        }

        console.log(`🛣️ [Routes] Parseados ${results.length} resultados`);

        // Mapear resultados con metadata de orígenes
        const mapped = results.map(r => {
            const originData = origins[r.originIndex] || {};
            const durationSeconds = r.duration ? parseInt(r.duration.replace('s', '')) : 9999;

            return {
                ...originData,
                originIndex: r.originIndex,
                status: r.status?.code || (r.condition ? 'OK' : 'ERROR'),
                condition: r.condition,
                distanceMeters: r.distanceMeters || 0,
                distanceKm: r.distanceMeters ? (r.distanceMeters / 1000).toFixed(2) : null,
                durationSeconds,
                durationMin: Math.round(durationSeconds / 60)
            };
        });

        // Ordenar por duración y distancia (como desempate)
        mapped.sort((a, b) => {
            if (a.durationMin !== b.durationMin) {
                return a.durationMin - b.durationMin;
            }
            return (a.distanceMeters || 0) - (b.distanceMeters || 0);
        });

        return mapped;

    } catch (error) {
        console.error('❌ Error en Routes API:', error.message);
        return null;
    }
}

module.exports = {
    computeRouteMatrix
};
