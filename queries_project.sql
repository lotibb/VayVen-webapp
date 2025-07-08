CREATE EXTENSION postgis;

SELECT PostGIS_Version();

show tables

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

drop table parada_autobus

CREATE TABLE rutas_autobuses (
  id SERIAL PRIMARY KEY,
  nombre_ruta TEXT,
  numero_ruta TEXT NOT NULL,
  geom GEOMETRY(LINESTRING, 4326),
  color TEXT DEFAULT '#3392ff',
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE paradas_autobuses (
  id SERIAL PRIMARY KEY,
  nombre_parada TEXT,
  geom GEOMETRY(POINT, 4326),
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE rutas_completas (
  id SERIAL PRIMARY KEY,
  ruta_id INTEGER NOT NULL REFERENCES rutas_autobuses(id) ON DELETE CASCADE,
  parada_id INTEGER NOT NULL REFERENCES paradas_autobuses(id) ON DELETE CASCADE
);

-- Spatial indexes
CREATE INDEX idx_rutas_autobuses_geom ON rutas_autobuses USING GIST (geom);
CREATE INDEX idx_paradas_autobuses_geom ON paradas_autobuses USING GIST (geom);

-- Relational indexes
CREATE INDEX idx_rutas_completas_ruta_id ON rutas_completas(ruta_id);
CREATE INDEX idx_rutas_completas_parada_id ON rutas_completas(parada_id);

INSERT INTO rutas_autobuses (nombre_ruta, numero_ruta, geom, color)
VALUES 
  ('Quinta Avenida', '22',
   ST_GeomFromText('LINESTRING( -89.616022 20.958197, -89.613783 20.957528, -89.611415 20.956847)', 4326),
   '#ff5733');

 SELECT * FROM rutas_autobuses;

 CREATE TEMP TABLE rutas_tmp (
  nombre_ruta TEXT,
  numero_ruta TEXT,
  wkt TEXT
);







