-- Enable PostGIS if available (optional, but good practice)
-- CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS commercials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    zip_code VARCHAR(10),
    city VARCHAR(100),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zip_codes (
    code VARCHAR(10) PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    province VARCHAR(100),
    viable BOOLEAN DEFAULT false,
    assigned_commercial_id INTEGER REFERENCES commercials(id)
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Insert default roles if they don't exist
INSERT INTO roles (name, permissions)
VALUES
    ('admin', '["all"]'),
    ('user', '["search:read"]')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS routes_cache (
    id SERIAL PRIMARY KEY,
    origin_zip VARCHAR(10) REFERENCES zip_codes(code),
    commercial_id INTEGER REFERENCES commercials(id),
    distance_km DECIMAL(10, 2),
    duration_min INTEGER,
    status VARCHAR(20), -- 'OK', 'NOT_FOUND', etc.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(origin_zip, commercial_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes_cache(origin_zip);
