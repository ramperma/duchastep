const axios = require('axios');

/**
 * Geocode an address using Google Geocoding API
 * @param {string} address - The address to geocode
 * @returns {Object} - { lat, lng, postalCode, formattedAddress } or null if not found
 */
async function geocodeAddress(address) {
    const apiKey = process.env.GOOGLE_MAPS_KEY;

    if (!apiKey) {
        console.error('❌ GOOGLE_MAPS_KEY no configurada');
        return null;
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: apiKey,
                language: 'es',
                region: 'es'
            }
        });

        if (response.data.status !== 'OK' || !response.data.results.length) {
            console.log(`⚠️ Geocoding: No se encontró la dirección "${address}"`);
            return null;
        }

        const result = response.data.results[0];
        const location = result.geometry.location;

        // Extract postal code from address components
        let postalCode = null;
        for (const component of result.address_components) {
            if (component.types.includes('postal_code')) {
                postalCode = component.long_name;
                break;
            }
        }

        return {
            lat: location.lat,
            lng: location.lng,
            postalCode: postalCode,
            formattedAddress: result.formatted_address
        };

    } catch (error) {
        console.error('❌ Error en Geocoding API:', error.message);
        return null;
    }
}

/**
 * Check if input is a postal code (5 digits for Spain)
 * @param {string} input 
 * @returns {boolean}
 */
function isPostalCode(input) {
    return /^\d{5}$/.test(input.trim());
}

module.exports = {
    geocodeAddress,
    isPostalCode
};
