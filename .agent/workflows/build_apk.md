---
description: Cómo generar el APK de Android para Duchastep
---

# Generar APK de Android

Este workflow describe cómo compilar la aplicación y generar el archivo APK instalable.

## Requisitos
*   Android Studio instalado.
*   Proyecto sincronizado (`npx cap sync`).

## Pasos

1.  **Abrir el proyecto en Android Studio:**
    Ejecuta el siguiente comando desde la carpeta `client`:
    ```bash
    npx cap open android
    ```
    O abre manualmente la carpeta `client/android` desde Android Studio.

2.  **Configurar URL de la API (Importante):**
    *   Asegúrate de que tu móvil y tu ordenador están en la misma red WiFi.
    *   Averigua la IP local de tu ordenador (ej: `192.168.1.35`).
    *   Edita el archivo `client/src/config.js` y cambia la URL por defecto o asegúrate de que `VITE_API_URL` apunta a esa IP.
    *   Si cambias algo en el código, recuerda reconstruir:
        ```bash
        cd client
        npm run build
        npx cap sync
        ```

3.  **Generar APK Debug (Pruebas):**
    *   En Android Studio, ve a **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
    *   Una vez termine, aparecerá una notificación "APK(s) generated successfully".
    *   Haz clic en **locate** para encontrar el archivo `app-debug.apk`.
    *   Envía ese archivo a tu móvil e instálalo.

4.  **Generar APK Firmado (Producción/Play Store):**
    *   Ve a **Build > Generate Signed Bundle / APK**.
    *   Selecciona **APK** (para instalación manual) o **Android App Bundle** (para Play Store).
    *   Crea un nuevo KeyStore (o usa uno existente).
    *   Selecciona la variante `release`.
    *   El APK generado estará optimizado y listo para distribuir.

## Solución de Problemas Comunes

*   **Error de conexión (Network Error):**
    *   Verifica que el servidor backend está corriendo (`npm run dev` o `npm start` en `server`).
    *   Verifica que el móvil puede acceder a la IP del ordenador (firewall, misma red).
    *   En Android 9+, el tráfico HTTP (no HTTPS) está bloqueado por defecto. Capacitor ya lo permite en la configuración, pero asegúrate de usar la IP correcta.

*   **Cambios no se ven:**
    *   Siempre que modifiques código React, debes ejecutar `npm run build` y `npx cap sync` antes de compilar en Android Studio.
