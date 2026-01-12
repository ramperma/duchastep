# Optimización de Operativa de Rutas y Direcciones

## Requerimientos Críticos

Para que la operativa sea práctica y eficiente, el sistema debe cumplir los siguientes puntos:

1.  **Sugerir direcciones al escribir:**
    - Evita que se asigne una dirección incorrecta.
    - Implementar estrategias para no disparar llamadas innecesarias a la API.
2.  **Calcular rutas por coordenadas:**
    - Se debe calcular las rutas por coordenadas para evitar variaciones importantes en minutos.
    - Las coordenadas se obtienen de la dirección exacta y se comparan con las de los comerciales y la sede.
3.  **Filtrar los 5 más cercanos:**
    - Antes de llamar a Google, se calcula la distancia en línea recta (Haversine) sobre todos los comerciales.
    - Solo se calculan las rutas reales mediante API para los 5 más cercanos y la sede.

---

## CAPA 1: Arquitectura de la Solución

Para sugerir direcciones correctamente y calcular tiempos, se utiliza **Places API (New)** (sugerencias y dirección “oficial”) y **Routes API** (minutos en coche).

### Claves para el control de costes:
- **minChars=5**: Contar solo letras/números antes de buscar.
- **Debounce 600 ms** y **Throttle 1000 ms**.
- **SessionToken**: Uso correcto para agrupar peticiones.
- **includedRegionCodes: ["ES"]**: Restringir búsquedas solo a España.
- **Haversine**: Pre-filtrado matemático para quedarse con el TOP 5 comercial + sede.
- **Field Mask**: Pedir solo campos mínimos en Routes API.

---

## CAPA 2: Metodología y Auditoría

### Metodología
Se ha verificado en la documentación oficial de Google:
- Funcionamiento de **Autocomplete (New)**, `sessionToken` e `includedRegionCodes`.
- Facturación por sesión y gestión de tokens.
- Llamadas a `computeRouteMatrix` en Routes y la importancia del `field mask` (incluyendo status).
- Validación de la fórmula **Haversine** como proceso local (no API).

### Limitaciones
- La arquitectura asume llamadas desde el **Backend** para proteger la API Key.
- Los precios y tiers pueden variar; el enfoque es minimizar el consumo técnico.

---

## Guía Definitiva (Paso a Paso)

### Objetivo Funcional
1. La teleoperadora escribe una dirección ⇒ Sugerencias correctas en España ⇒ Se elige una ⇒ Guardamos dirección oficial + coordenadas.
2. Con la dirección elegida ⇒ Calculamos km con Haversine ⇒ Calculamos minutos reales (sin tráfico) del TOP 5 + sede ⇒ Ranking de rapidez.

### PASO 0 — Decisión de Arquitectura
- **Frontend**: Gestiona UI (caja de texto, sugerencias, resultados).
- **Backend (Servidor)**: Único encargado de llamar a Google (Places New + Routes). Protege la API Key y centraliza la lógica.

### PASO 1 — Google Cloud: Configuración
1.  **APIs a activar**:
    - Places API (New)
    - Routes API
2.  **Restricciones de API Key**:
    - Restringir por API (solo las dos mencionadas).
    - Restringir por IP (IP del servidor VPS).

### PASO 2 — Datos Fijos (Estrategia de Ahorro)
Guardar una única vez las coordenadas (lat/lng) de la **Sede Duchastep** y de todos los **Comerciales** en un JSON o Base de Datos. Evita geocodificar puntos conocidos repetidamente.

```javascript
export const HQ = { name: "DUCHASTEP (Sede)", lat: 39.4828, lng: -0.3831 };
export const SALES = [
  { name: "Comercial 1", lat: 39.50, lng: -0.40 },
  // ...
];
```

### PASO 3 — Backend: Endpoint de Autocompletado
**Endpoint: `/api/autocomplete`**
- Uso obligatorio de `includedRegionCodes: ["ES"]`.
- Gestión de `sessionToken`.

```javascript
app.post("/api/autocomplete", async (req, res) => {
  const { input, sessionToken } = req.body;
  if (!input || !sessionToken) return res.status(400).send("Faltan datos");

  const resp = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["ES"],
      languageCode: "es",
    }),
  });
  const data = await resp.json();
  return res.json(data);
});
```

### PASO 4 — Backend: Selección y Cierre de Sesión
Cuando el usuario selecciona una sugerencia, se llama a **Place Details (New)** con el mismo `sessionToken` para obtener coordenadas y cerrar el ciclo de facturación.

```javascript
async function getPlaceDetails(placeId, sessionToken) {
  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  url.searchParams.set("fields", "location,formattedAddress");
  url.searchParams.set("sessionToken", sessionToken);

  const resp = await fetch(url, {
    headers: { "X-Goog-Api-Key": GOOGLE_API_KEY },
  });
  const data = await resp.json();
  return {
    formattedAddress: data.formattedAddress,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
```

### PASO 5 — Haversine: Filtrado local (TOP 5)
Cálculo matemático de distancia en línea recta para evitar llamar a Google por cada comercial.

```javascript
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### PASO 6 — Routes: Cálculo real de 6 elementos
Se envían 6 orígenes (TOP 5 + sede) y 1 destino (cliente).

```javascript
// Field mask obligatorio: originIndex, destinationIndex, status, condition, distanceMeters, duration
// routingPreference: "TRAFFIC_UNAWARE"
```

### PASO 7 — Endpoint Final `/api/ranking`
1. Recibe `placeId` y `sessionToken`.
2. Llama a `getPlaceDetails`.
3. Filtra comerciales mediante Haversine (TOP 5).
4. Llama a Routes API para los 6 puntos.
5. Devuelve ranking ordenado por tiempo.

### PASO 8 — Frontend: Optimización de Entrada
- **minChars=5** (letras/números).
- **Debounce** (600ms).
- **Throttle** (1000ms).
- Generar nuevo `sessionToken` después de cada selección finalizada.

### PASO 9 — Checklist de Validación
- [ ] Autocomplete solo en España.
- [ ] Place Details recupera coordenadas correctamente.
- [ ] Haversine selecciona el TOP 5 antes de ir a Google.
- [ ] Routes API usa `TRAFFIC_UNAWARE` y field mask con `status`.
- [ ] Google Cloud Metrics muestra uso en las APIs (New).

### PASO 10 — Notas Legales y UX
No olvidar incluir la atribución "Powered by Google" si se utiliza una UI personalizada para las sugerencias.
