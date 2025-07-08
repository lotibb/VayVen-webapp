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

  map.on("load", async () => {
    // Load GeoJSON route layer from your backend
    map.addSource("rutas", {
      type: "geojson",
      data: `${apiUrl}`
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

    // Then try to move to user location
    const userLocation = await getUserLocation();
    if (userLocation) {
      map.flyTo({ center: userLocation, zoom: 15 });

      new maplibregl.Popup({
        closeOnClick: false,
      })
        .setLngLat(userLocation)
        .setHTML("<h3>You are approximately here!</h3>")
        .addTo(map);

      new maplibregl.Marker().setLngLat(userLocation).addTo(map);
    }
  });
}

init();
