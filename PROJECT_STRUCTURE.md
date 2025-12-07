# Documentación de Estructura del Proyecto Duchastep

Este documento describe la estructura de archivos y directorios del proyecto, detallando la función de cada componente principal. Sirve como referencia para desarrolladores que deseen mantener o extender la funcionalidad del sistema.

## 📂 Directorio Raíz (`/`)

*   **`README.md`**: Documentación general del proyecto.
*   **`.env`**: (No incluido en el repositorio por seguridad) Variables de entorno globales (credenciales DB, puertos, etc.).
*   **`.gitignore`**: Define qué archivos ignorar en el control de versiones (ej: `node_modules`, `.env`).

---

## 💻 Cliente (`/client`)

Frontend de la aplicación construido con **React + Vite** y estilizado con **Tailwind CSS**.

### Configuración y Entrada
*   **`src/main.jsx`**: Punto de entrada de React. Monta la aplicación en el DOM.
*   **`src/App.jsx`**: Componente raíz. Define el enrutamiento (`react-router-dom`), las rutas protegidas (`PrivateRoute`) y la estructura general.
*   **`src/config.js`**: Archivo de configuración global. Define `API_URL` para conectar con el backend (maneja diferencias entre localhost y producción).
*   **`src/index.css`**: Estilos globales y directivas de Tailwind CSS.
*   **`vite.config.js`**: Configuración del empaquetador Vite (proxies, plugins).

### Componentes (`src/components/`)
Elementos de interfaz reutilizables.
*   **`Layout.jsx`**: "Wrapper" principal de la aplicación. Contiene la barra lateral de navegación (Sidebar), la cabecera y maneja la estructura visual común para todas las páginas autenticadas.
*   **`ResultCard.jsx`**: Componente visual para mostrar los resultados de una búsqueda de viabilidad de cliente (si es viable o no, distancia, comercial asignado).

### Páginas (`src/pages/`)
Vistas principales accesibles mediante rutas.
*   **`Login.jsx`**: Pantalla de inicio de sesión. Gestiona la autenticación JWT.
*   **`Search.jsx`**: **Página Principal/Dashboard**. Contiene el buscador de códigos postales, la lógica de validación de viabilidad y muestra los resultados.
*   **`Admin.jsx`**: Gestión de **Comerciales**. Permite crear, editar, eliminar y activar/desactivar comerciales.
*   **`Zips.jsx`**: Gestión de **Códigos Postales**. Permite dar de alta nuevas zonas (CPs) manualmente, ver el listado y recalcular rutas para zonas específicas.
*   **`Users.jsx`**: Gestión de usuarios y roles de la aplicación (Admin vs Usuario estándar).
*   **`Config.jsx`**: Panel de control general. Permite:
    *   Subir el logo de la empresa.
    *   Configurar la dirección central.
    *   **Ejecutar el Precálculo Masivo** de rutas (controlando el progreso vía SSE).

---

## 🖥️ Servidor (`/server`)

Backend API construido con **Node.js + Express** y base de datos **PostgreSQL**.

### Núcleo
*   **`index.js`**: Punto de entrada del servidor. Inicializa Express, configura middlewares (CORS, JSON), conecta las rutas y sirve archivos estáticos (`/uploads`).
*   **`db.js`**: Configuración del pool de conexiones a PostgreSQL usando `pg`. Carga variables de entorno.
*   **`schema.sql`**: Definición del esquema de la base de datos (tablas: `commercials`, `zip_codes`, `users`, `routes_cache`, `settings`, etc.).

### Rutas API (`routes/`)
Definición de endpoints HTTP.
*   **`api.js`**: Contiene la lógica principal de negocio:
    *   Búsqueda de viabilidad (`GET /api/search`).
    *   CRUD de Comerciales (`GET/POST/PUT/DELETE /commercials`).
    *   CRUD de Códigos Postales (`GET/POST/PUT /zips`).
    *   Gestión de Usuarios.
*   **`auth.js`**: Rutas de autenticación (`POST /login`). Genera tokens JWT.
*   **`settings.js`**: Rutas de configuración.
    *   Gestión de logo y variables globales.
    *   **Endpoint de Progreso (`SSE`)**: Envía eventos en tiempo real al frontend durante el precálculo de rutas.

### Servicios (`services/`)
Lógica compleja separada de los controladores.
*   **`maps.js`**: Wrapper para la API de Google Maps (Distance Matrix). Maneja las peticiones de distancias y tiempos. Incluye lógica de fallback o mock si no hay API Key.
*   **`precalc.js`**: Motor de precálculo de rutas. Contiene:
    *   `runPrecalculation`: Lógica masiva (Central -> CPs y CPs -> Comerciales).
    *   `runZipPrecalculation`: Cálculo para un solo CP (usado al crear zonas).
    *   `runCommercialPrecalculation`: Cálculo para un solo comercial.
    *   Lógica de caché: Guarda resultados en tabla `routes_cache` para evitar peticiones futuras.

### Scripts de Utilidad y Mantenimiento
Scripts independientes para tareas administrativas o de configuración inicial.
*   **`seed.js`**: Script de "semilla" para poblar la BD con datos de prueba iniciales (comerciales y CPs ficticios).
*   **`seed_valencia.js`**: Carga masiva específica de CPs de la Comunidad Valenciana.
*   **`createAdmin.js`**: Crea un usuario administrador por defecto si no existe.
*   **`import_excel.js`**: Script legacy para importar datos desde el Excel original (útil para migraciones).
*   **`update_commercials.js`**, **`insert_missing.js`**, etc.: Scripts auxiliares para correcciones puntuales de datos.
*   **`test_*.js`**: Scripts pequeños de prueba (ej: `test_maps_cost.js`, `test_46001.js`) para verificar funcionalidades aisladas sin levantar todo el servidor.

---

## 🗄️ Base de Datos (Estructura Clave)

*   **`commercials`**: Agentes comerciales (ubicación, estado activo).
*   **`zip_codes`**: Zonas geográficas. Incluye `min_to_central` (tiempo cacheado a la central).
*   **`routes_cache`**: Tabla crítica de rendimiento. Almacena la distancia y tiempo pre-calculado entre un `origin_zip` y un `commercial_id`.
*   **`settings`**: Almacén clave-valor para configuración dinámica (Logo, Dirección Central).

---

## 🚀 Flujo de Precálculo (Vital)

El sistema se basa en un precálculo para ser eficiente:
1.  **Central**: Se calcula el tiempo de `Central` -> `CP` y se guarda en `zip_codes.min_to_central`.
2.  **Rutas**: Se cruzan todos los CPs viables con todos los comerciales activos. Se consulta Google Maps y se guarda en `routes_cache`.
3.  **Búsqueda**: Cuando un usuario busca un CP, el sistema **NO** llama a Google Maps. Consulta `zip_codes` (para ver si entra en 100 min de central) y `routes_cache` (para ver si hay comercial a < 30 min). Esto hace la búsqueda instantánea y gratuita.
