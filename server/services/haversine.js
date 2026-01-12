/**
 * Haversine - Cálculo de distancia en línea recta entre dos puntos geográficos
 * Fórmula matemática pura, sin llamadas a API
 */

/**
 * Calcula la distancia en kilómetros entre dos coordenadas
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en kilómetros
 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const toRad = deg => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Filtra y ordena puntos por distancia Haversine, devolviendo los N más cercanos
 * @param {Object} origin - { lat, lng } origen
 * @param {Array} points - Array de objetos con { lat, lng, ...rest }
 * @param {number} topN - Número de puntos a devolver
 * @returns {Array} Los N puntos más cercanos con distancia añadida
 */
function filterTopN(origin, points, topN = 5) {
    if (!origin || !origin.lat || !origin.lng) {
        console.error('❌ Haversine: Origen inválido');
        return [];
    }

    const withDistance = points
        .filter(p => p.lat && p.lng) // Solo puntos con coordenadas válidas
        .map(p => ({
            ...p,
            haversineKm: haversineKm(origin.lat, origin.lng, p.lat, p.lng)
        }))
        .sort((a, b) => a.haversineKm - b.haversineKm);

    return withDistance.slice(0, topN);
}

module.exports = {
    haversineKm,
    filterTopN
};
