require("dotenv").config(); // Load environment variables

const path = require("path")
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors"); 

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection using env variables

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

/* const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "merida_geospatial_db",
  password: "tuHero51?",
  port: 5432,
}); */

// Test PostgreSQL connection on startup
pool.connect()
  .then(client => {
    console.log("Connected to PostgreSQL database");
    client.release();
  })
  .catch(err => {
    console.error("Failed to connect to PostgreSQL:", err.message);
    process.exit(1); // Stop the server if connection fails
  });

app.use(cors())

// 🔸 Serve your real folders:
app.use(express.static(path.join(__dirname, "public")));

/**
 * GET /rutas
 * Returns all bus routes as GeoJSON FeatureCollection
 */
app.get("/rutas", async (req, res) => {
  try {
    // Fetch routes
    const rutasResult = await pool.query(`
      SELECT 
        id, 
        nombre_ruta, 
        numero_ruta, 
        color, 
        activo,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM rutas_autobuses
    `);

    const rutasGeoJSON = {
      type: "FeatureCollection",
      features: rutasResult.rows.map(row => ({
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

    // Fetch stops (paradas)
    const paradasResult = await pool.query(`
      SELECT 
        p.id,
        p.nom_parada AS nombre_parada,
        p.activo,
        r.color,
        ST_AsGeoJSON(p.geom)::json AS geometry
      FROM paradas_autobuses p
      JOIN rutas_paradas rp ON p.nom_parada = rp.nom_parada
      JOIN rutas_autobuses r ON rp.numero_ruta = r.numero_ruta;
    `);

    const paradasGeoJSON = {
      type: "FeatureCollection",
      features: paradasResult.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: row.id,
          nombre_parada: row.nombre_parada,
          activo: row.activo,
          color: row.color
        }

      }))
    };

    const tiendasResult = await pool.query(`
      SELECT 
        id_denue,
        nom_estab,
        raz_social,
        nom_tienda,
        fecha_alta,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM tiendas
    `);

    const tiendasGeoJSON = {
      type: "FeatureCollection",
      features: tiendasResult.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id_denue: row.id_denue,
          nom_estab: row.nom_estab,
          raz_social: row.raz_social,
          nom_tienda: row.nom_tienda,
          fecha_alta: row.fecha_alta
        }
      }))
    };  

    // Send both as one JSON response
    res.json({
      rutas: rutasGeoJSON,
      paradas: paradasGeoJSON,
      tiendas: tiendasGeoJSON
    });

  } catch (error) {
    console.error("Error fetching rutas or paradas:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});


app.listen(port, () => {
  console.log(`🚍 Backend API listening at http://localhost:${port}`);
});