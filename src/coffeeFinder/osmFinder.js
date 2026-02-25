// OpenStreetMap / Nominatim / Overpass-based coffee shop finder.
// No API keys required.

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OSM request to ${url} failed with status ${res.status}: ${body}`
    );
  }
  return await res.json();
}

// (a) Geocode an address using Nominatim.
async function geocodeAddressOSM(address) {
  const q = String(address ?? "").trim();
  if (!q) throw new Error("Address is required.");

  const url =
    NOMINATIM_BASE_URL +
    `?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=0`;

  const data = await fetchJson(url, {
    headers: {
      "User-Agent": "cafe.ly/1.0 (OSM geocoding)",
      Accept: "application/json",
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No results from Nominatim for that address.");
  }

  const first = data[0];
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid coordinates returned by Nominatim.");
  }

  return { lat, lon };
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildAddressFromTags(tags) {
  if (!tags) return "";
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
    tags["addr:country"],
  ].filter(Boolean);
  return parts.join(", ");
}

// (b) Find coffee shops around lat/lon using Overpass.
async function findCoffeeShopsOSM(lat, lon, radius = 2000) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"](around:${radius},${lat},${lon});
      way["amenity"="cafe"](around:${radius},${lat},${lon});
      relation["amenity"="cafe"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  const body = `data=${encodeURIComponent(query)}`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "cafe.ly/1.0 (OSM overpass)",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Overpass request failed with status ${res.status}: ${text}`
    );
  }

  const data = await res.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const shops = elements.map((el) => {
    const tags = el.tags || {};
    const name = tags.name || "Coffee shop";

    // Node has lat/lon directly; ways/relations use "center".
    const latEl = el.lat ?? (el.center && el.center.lat);
    const lonEl = el.lon ?? (el.center && el.center.lon);

    const latitude = Number(latEl);
    const longitude = Number(lonEl);

    const address = buildAddressFromTags(tags);
    const distance_m =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? haversineDistanceMeters(lat, lon, latitude, longitude)
        : NaN;

    return {
      id: el.id,
      name,
      latitude,
      longitude,
      address,
      tags,
      source: "OSM",
      // extra fields to keep existing UI happy
      distance_m: Number.isFinite(distance_m) ? distance_m : 0,
      rating: undefined,
      sentiment: 0,
    };
  });

  return shops;
}

// (c) Convenience: address → coordinates → nearby coffee shops.
async function findCoffeeShopsByAddressOSM(address) {
  const { lat, lon } = await geocodeAddressOSM(address);
  return await findCoffeeShopsOSM(lat, lon);
}

module.exports = {
  geocodeAddressOSM,
  findCoffeeShopsOSM,
  findCoffeeShopsByAddressOSM,
};

