(function () {
  let mapInstance = null;
  const markers = [];
  const markersById = new Map();
  let highlightedId = null;

  function initMap(lat, lon) {
    if (typeof L === "undefined") {
      console.warn("Leaflet.js is not loaded (global L is undefined). Skipping map init.");
      return null;
    }

    if (!mapInstance) {
      mapInstance = L.map("coffee-finder-map").setView([lat, lon], 15);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapInstance);
    } else {
      mapInstance.setView([lat, lon], 15);
    }

    return mapInstance;
  }

  function clearMarkers() {
    if (!mapInstance) return;
    markers.forEach((m) => mapInstance.removeLayer(m));
    markers.length = 0;
    markersById.clear();
    highlightedId = null;
  }

  function addMarker(lat, lon, label, options = {}) {
    if (!mapInstance || typeof L === "undefined") {
      return null;
    }

    const marker = L.marker([lat, lon]).addTo(mapInstance);
    if (label) {
      marker.bindPopup(label);
    }

    const id = options.id ?? `${lat},${lon}`;
    markers.push(marker);
    markersById.set(String(id), marker);

    if (typeof options.onClick === "function") {
      marker.on("click", () => options.onClick(String(id), marker));
    }

    return marker;
  }

  function highlightMarker(id) {
    if (!mapInstance) return;
    const key = String(id);
    const marker = markersById.get(key);
    if (!marker) return;

    if (highlightedId && highlightedId !== key) {
      const prev = markersById.get(highlightedId);
      if (prev) {
        prev.setZIndexOffset(0);
      }
    }

    highlightedId = key;
    marker.setZIndexOffset(1000);
    marker.openPopup();
    mapInstance.panTo(marker.getLatLng());
  }

  const api = {
    initMap,
    addMarker,
    clearMarkers,
    highlightMarker,
  };

  if (typeof window !== "undefined") {
    window.cafeMap = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

