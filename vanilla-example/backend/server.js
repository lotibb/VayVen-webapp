const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const port = 3000;

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "merida_geospatial_db",
  password: "tuHero51?",
  port: 5432,
});

// Enable CORS for frontend access
app.use(cors());

/**
 * GET /rutas
 * Returns all bus routes as GeoJSON FeatureCollection
 */
app.get("/rutas", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        nombre_ruta, 
        numero_ruta, 
        color, 
        activo,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM rutas_autobuses
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: row.id,
          nombre_ruta: row.nombre_ruta,
          numero_ruta: row.numero_ruta,
          color: row.color,
          activo: row.activo
        }
      }))
    };

    res.json(geojson);
  } catch (error) {
    console.error("Error fetching rutas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`🚍 Backend API listening at http://localhost:${port}`);
});
