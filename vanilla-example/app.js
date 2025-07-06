import "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

const merida = [-89.62, 20.97]; // Coordinates for Merida

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
    center: merida, // Start at Merida
    zoom: 11.8, // Initial zoom level
    container: "map",
  });

  const userLocation = await getUserLocation(); // Attempt to get the user's location
  if (userLocation) {
    map.flyTo({ center: userLocation, zoom: 15 }); // Fly to the user's location if obtained

    new maplibregl.Popup({
      closeOnClick: false,
    })
    .setLngLat(userLocation)
    .setHTML("<h3>You are approximately here!</h3>")
    .addTo(map);
    
    const marker = new maplibregl.Marker()
    .setLngLat(userLocation)
    .addTo(map);
  }
}

init();
