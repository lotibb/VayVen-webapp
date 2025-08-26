import "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

const merida = [-89.62, 20.97]; // Coordinates for Merida

const apiUrl = window.env?.API_URL || "http://localhost:3000";

const limites = [
  [-89.820316, 20.846415], // Coordenadas sureste
  [-89.453107, 21.173615] // Coordenadas noreste  
];

function getUserLocation() {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve([longitude, latitude]); // Return in the format [lon, lat]
        },
        (error) => {
          console.error("Error obtaining location:", error);
          resolve(null); // Resolve with null if there is an error
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      resolve(null); // Resolve with null if geolocation is not supported
    }
  });
}

async function init() {
  const map = new maplibregl.Map({
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: merida,
    zoom: 11.8,
    container: "map",
    maxBounds: limites
  });

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: false,
    showUserLocation: true,
    showAccuracyCircle: false
  });

  map.addControl(geolocate, "bottom-right");

  map.on("load", async () => {
    try {
      const response = await fetch(`${apiUrl}/rutas`);
      const geojson = await response.json();

      console.log("Fetched GeoJSON:", geojson);

      map.addSource("rutas", {
        type: "geojson",
        data: geojson.rutas
      });

      map.addLayer({
        id: "rutas-lineas",
        type: "line",
        source: "rutas",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4
        }
      });

      map.addSource("paradas", {
        type: "geojson",
        data: geojson.paradas
      });

      map.addLayer({
        id: "paradas-puntos",
        type: "circle",
        source: "paradas",
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff"
        }
      });
    } catch (err) {
      console.error("Failed to load /rutas data:", err);
    }

    // ✅ This triggers auto-location when map loads
    geolocate.trigger();
  });
}


init();