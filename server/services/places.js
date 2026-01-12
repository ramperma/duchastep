/**
 * Places API (New) - Servicio para autocompletado y detalles de lugares
 * Documentación: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_KEY;

/**
 * Autocomplete - Busca sugerencias de direcciones en España
 * @param {string} input - Texto de búsqueda del usuario
 * @param {string} sessionToken - Token UUID para agrupar peticiones (facturación)
 * @returns {Array} Lista de sugerencias con placeId y descripción
 */
async function autocomplete(input, sessionToken) {
    if (!GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_MAPS_KEY no configurada');
        return { error: 'API Key no configurada' };
    }

    try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY
            },
            body: JSON.stringify({
                input,
                sessionToken,
                includedRegionCodes: ['ES'],
                languageCode: 'es'
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Places Autocomplete Error:', data.error.message);
            return { error: data.error.message };
        }

        // Transformar respuesta a formato simplificado
        const suggestions = (data.suggestions || []).map(s => ({
            placeId: s.placePrediction?.placeId,
            description: s.placePrediction?.text?.text || s.placePrediction?.structuredFormat?.mainText?.text,
            mainText: s.placePrediction?.structuredFormat?.mainText?.text,
            secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text
        })).filter(s => s.placeId);

        return { suggestions };

    } catch (error) {
        console.error('❌ Error en Places Autocomplete:', error.message);
        return { error: error.message };
    }
}

/**
 * Get Place Details - Obtiene coordenadas y dirección formateada
 * @param {string} placeId - ID del lugar seleccionado
 * @param {string} sessionToken - Mismo token usado en autocomplete (cierra sesión)
 * @returns {Object} { formattedAddress, lat, lng }
 */
async function getPlaceDetails(placeId, sessionToken) {
    if (!GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_MAPS_KEY no configurada');
        return null;
    }

    try {
        const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'location,formattedAddress,addressComponents',
                'X-Goog-SessionToken': sessionToken
            }
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Place Details Error:', data.error.message);
            return null;
        }

        // Extraer código postal de los componentes
        let postalCode = null;
        if (data.addressComponents) {
            const pcComponent = data.addressComponents.find(c =>
                c.types && c.types.includes('postal_code')
            );
            if (pcComponent) {
                postalCode = pcComponent.longText || pcComponent.shortText;
            }
        }

        return {
            formattedAddress: data.formattedAddress,
            lat: data.location?.latitude,
            lng: data.location?.longitude,
            postalCode
        };

    } catch (error) {
        console.error('❌ Error en Place Details:', error.message);
        return null;
    }
}

module.exports = {
    autocomplete,
    getPlaceDetails
};
