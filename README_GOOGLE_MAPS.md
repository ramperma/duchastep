# Configuración de Google Maps API para Duchastep

Este documento detalla los pasos para configurar correctamente la API de Google Maps en el proyecto.

## 1. APIs Necesarias

Para que el backend calcule correctamente las distancias y tiempos de viaje (módulo `server/services/maps.js`), es necesario habilitar las siguientes APIs en tu proyecto de Google Cloud:

1.  **Distance Matrix API** (Fundamental: calcula tiempos de viaje entre técnico y cliente).
2.  **Geocoding API** (Recomendada: para validar direcciones/códigos postales si el sistema lo requiere).

NO necesitas habilitar las 32 APIs (Maps SDK for Android, Places API, etc.) si solo vas a usar el cálculo de rutas en el servidor. Deshabilitar las que no usas añade una capa extra de seguridad.

## 2. Restricciones de la Clave (API Key)

Tienes la clave ya creada como "Maps Platform API Key". Sigue estos consejos para asegurarla:

### Restricciones de API
En la pestaña "Restricciones de API" de tu clave:
1.  Selecciona **"Restringir clave"**.
2.  En el desplegable, marca **ÚNICAMENTE**:
    *   Distance Matrix API
    *   Geocoding API (si la usas)
3.  Esto evita que si te roban la clave, puedan usarla para otros servicios (como mostrar mapas que cuestan mucho dinero).

### Restricciones de Aplicación
*   **Para Desarrollo (Localhost)**: Como el servidor (`monitor de precalculo` o `test_maps_cost.js`) corre en tu máquina local, la restricción por IP puede ser molesta si tu IP cambia. Lo habitual es dejarla en **Ninguno** MIENTRAS DESARROLLAS, pero asegurándote de **nunca subir el archivo `.env` a GitHub**.
*   **Para Producción (VPS)**: Debes seleccionar **"Direcciones IP"** y poner la IP pública de tu servidor VPS.

## 3. Configuración en el Proyecto

El servidor lee la clave desde el archivo de entorno.

1.  Ve a la carpeta `server/`.
2.  Abre (o crea) el archivo `.env`.
3.  Asegúrate de tener la siguiente línea:

```env
GOOGLE_MAPS_KEY=tu_clave_api_aqui_commemzando_por_AI...
```

## 4. Verificación

Para comprobar que todo funciona y que Google no está bloqueando la petición, hemos creado un script de prueba.

Ejecútalo desde la terminal en la carpeta `server/`:

```bash
cd server
node test_maps_cost.js
```

Si ves mensajes con `✅ [OK]`, tu clave está funcionando correctamente.

## Resumen de Credenciales
**No necesitas configurar OAuth ni Cuentas de Servicio** para este uso. La "API Key" simple que ya tienes es suficiente. El aviso de "OAuth consent screen" en la consola de Google es solo si tu app pidiera a los usuarios "Iniciar sesión con Google", lo cual no aplica aquí para el cálculo de rutas interno.

## 5. Cómo deshabilitar la API antigua (Para detener cobros)

Si tu objetivo es asegurarte de que la cuenta antigua deje de cobrarte, tienes dos opciones:

### Opción A: Borrar la clave antigua (Rápido)
1.  Entra en la [Consola de Google Cloud](https://console.cloud.google.com/) con tu **cuenta antigua**.
2.  En el menú lateral, ve a **APIs y servicios > Credenciales**.
3.  Borra la clave de API que estabas usando.
    *   *Efecto:* Inmediatamente dejará de funcionar cualquier petición con esa clave.

### Opción B: Cerrar la facturación o el proyecto (Definitivo)
1.  Ve a **Facturación** en el menú lateral.
2.  Selecciona tu cuenta de facturación y en "Administración de cuentas", elige **Cerrar cuenta de facturación** o **Desvincular facturación**.
3.  O bien, ve a **IAM y administración > Configuración** y dale a **Apagar proyecto**.
    *   *Efecto:* Se detienen todos los servicios y cobros de ese proyecto.

