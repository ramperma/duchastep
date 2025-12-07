// Configuration for API URL
// For Android Emulator use: 'http://10.0.2.2:3000'
// For Real Device use your LAN IP: 'http://192.168.1.X:3000'
// For Web (Localhost): 'http://localhost:3000'

// If we are in a browser (http/https), use relative path to let Vite Proxy or Nginx handle it.
// If we are in Capacitor (file://), we need an absolute URL.
const isBrowser = window.location.protocol.startsWith('http');

export const API_URL = isBrowser ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
