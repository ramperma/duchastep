const axios = require('axios');

// Mock implementation to avoid API costs during dev
const getDistancesMock = async (origins, destinations) => {
    // origins: array of { lat, lng } or strings
    // destinations: array of { lat, lng } or strings

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return origins.map((origin) => ({
        elements: destinations.map((dest) => {
            let distanceVal = Math.floor(Math.random() * 145000) + 5000; // Default random

            // Try to extract ZIP codes to be smarter
            // Format expected: "46001, Spain" or "Address, 46001, Spain"
            const zipRegex = /\b\d{5}\b/;

            const originStr = typeof origin === 'string' ? origin : '';
            const destStr = typeof dest === 'string' ? dest : '';

            const originZipMatch = originStr.match(zipRegex);
            const destZipMatch = destStr.match(zipRegex);

            if (originZipMatch && destZipMatch) {
                const zip1 = originZipMatch[0];
                const zip2 = destZipMatch[0];

                if (zip1 === zip2) {
                    distanceVal = 1000; // 1 km
                } else if (zip1.substring(0, 4) === zip2.substring(0, 4)) {
                    distanceVal = 3000; // 3 km (Same neighborhood/town)
                } else if (zip1.substring(0, 3) === zip2.substring(0, 3)) {
                    distanceVal = 8000; // 8 km (Same city area)
                } else if (zip1.substring(0, 2) === zip2.substring(0, 2)) {
                    distanceVal = 30000; // 30 km (Same province)
                } else {
                    distanceVal = 150000; // 150 km (Different province)
                }

                // Add some random noise (+- 20%) to make it look real
                const noise = (Math.random() * 0.4) + 0.8;
                distanceVal = Math.floor(distanceVal * noise);
            }

            // Calculate duration based on 40km/h avg speed (urban) or 80km/h (interurban)
            const speedKmh = distanceVal < 10000 ? 30 : 80;
            const durationVal = Math.floor((distanceVal / 1000) / speedKmh * 3600);

            return {
                status: 'OK',
                distance: { value: distanceVal, text: `${(distanceVal / 1000).toFixed(1)} km` },
                duration: { value: durationVal, text: `${Math.floor(durationVal / 60)} mins` }
            };
        })
    }));
};

const getDistancesReal = async (origins, destinations) => {
    if (!process.env.GOOGLE_MAPS_KEY) {
        console.warn('⚠️ No Google Maps Key found. Using Mock.');
        return getDistancesMock(origins, destinations);
    }

    // Real call to Google Distance Matrix API
    try {
        const apiKey = process.env.GOOGLE_MAPS_KEY;
        const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
            params: {
                origins: origins.join('|'),
                destinations: destinations.join('|'),
                key: apiKey,
                units: 'metric' // Returns km and meters
            }
        });

        if (response.data.status !== 'OK') {
            console.error('Google Maps API Error:', response.data.error_message || response.data.status);
            return getDistancesMock(origins, destinations); // Fallback on API error
        }

        return response.data.rows; // Returns array of elements matching origins to destinations

    } catch (err) {
        console.error('Error fetching distances from Google:', err.message);
        return getDistancesMock(origins, destinations); // Fallback on network error
    }
};

/**
 * Get distance matrix from a single origin to multiple destinations
 * Used for hybrid precision recalculation
 * @param {string} origin - Origin coordinates "lat,lng"
 * @param {Array<string>} destinations - Array of destination coordinates "lat,lng"
 * @returns {Array} Array of { distance_km, duration_min } for each destination
 */
const getDistanceMatrix = async (origin, destinations) => {
    if (!process.env.GOOGLE_MAPS_KEY) {
        console.warn('⚠️ No Google Maps Key found. Cannot recalculate with precision.');
        return null;
    }

    try {
        const apiKey = process.env.GOOGLE_MAPS_KEY;
        const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
            params: {
                origins: origin,
                destinations: destinations.join('|'),
                key: apiKey,
                units: 'metric'
            }
        });

        if (response.data.status !== 'OK' || !response.data.rows.length) {
            console.error('Distance Matrix Error:', response.data.error_message || response.data.status);
            return null;
        }

        const elements = response.data.rows[0].elements;
        return elements.map((el) => {
            if (el.status !== 'OK') {
                return { distance_km: 999, duration_min: 999 };
            }
            return {
                distance_km: (el.distance.value / 1000).toFixed(2),
                duration_min: Math.round(el.duration.value / 60)
            };
        });

    } catch (err) {
        console.error('Error in getDistanceMatrix:', err.message);
        return null;
    }
};

module.exports = {
    getDistances: getDistancesReal,
    getDistanceMatrix
};
