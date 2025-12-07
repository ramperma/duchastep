# Duchastep - Verificador de Visitas

Sistema de gestión de visitas y verificación de viabilidad por código postal para comerciales.

## Características

*   **Buscador Público:** Verifica si un cliente es viable basándose en su Código Postal y la distancia a los comerciales activos.
*   **Panel de Administración:**
    *   Gestión de Comerciales (CRUD).
    *   Gestión de Usuarios y Roles (RBAC).
    *   Configuración del sistema (Logo personalizado).
*   **Cálculo de Rutas:** Sistema inteligente de cálculo de distancias (con caché y heurística para modo desarrollo).

## Requisitos Previos

*   Node.js (v18 o superior)
*   PostgreSQL (v14 o superior)

## Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone <url-del-repo>
    cd duchastep
    ```

2.  **Instalar dependencias:**
    
    Desde la raíz del proyecto (instala dependencias de raíz, cliente y servidor):
    ```bash
    npm install
    cd client && npm install
    cd ../server && npm install
    cd ..
    ```

## Configuración de Base de Datos

1.  Asegúrate de tener PostgreSQL corriendo.
2.  Crea la base de datos:
    ```sql
    CREATE DATABASE duchastep;
    ```
    *(El sistema creará las tablas automáticamente al iniciar el servidor)*.

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la carpeta `server/` con el siguiente contenido:

    ```env
    PORT=3000
    DB_USER=postgres
    DB_HOST=localhost
    DB_NAME=duchastep
    DB_PASSWORD=tu_contraseña
    DB_PORT=5432
    JWT_SECRET=tu_secreto_super_seguro
    # GOOGLE_MAPS_KEY=tu_api_key (Opcional, si no se pone usa modo Mock)
    ```

## Carga de Datos Iniciales (Semilla)

Para cargar códigos postales de la Comunidad Valenciana y el usuario administrador por defecto:

1.  **Crear Admin:**
    ```bash
    cd server
    node createAdmin.js
    ```
    *Usuario: `admin` / Contraseña: `password123`*

2.  **Importar Datos Excel (CPs y Comerciales):**
    *Nota: Este paso solo es necesario si se necesita recargar la base de datos desde cero.*
    Coloca el archivo `TODOS CP COMUNIDAD VALENCIANA.xlsx` en la raíz (si no existe) y ejecuta:
    ```bash
    cd server
    node import_excel.js
    ```
    *Esto cargará los códigos postales en la base de datos.*

## Ejecución

Para iniciar tanto el cliente (Vite) como el servidor (Express) en modo desarrollo:

```bash
# Desde la raíz del proyecto
npm run dev
```

*   **Frontend:** http://localhost:5173
*   **Backend:** http://localhost:3000

## Estructura del Proyecto

*   `/client`: Frontend React + Vite + TailwindCSS.
*   `/server`: Backend Node.js + Express + PostgreSQL.
*   `/server/uploads`: Carpeta para almacenar logos e imágenes subidas.
