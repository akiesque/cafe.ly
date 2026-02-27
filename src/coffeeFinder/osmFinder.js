// OpenStreetMap / Nominatim / Overpass-based coffee shop finder.
// Purely open-source data, no API keys required.

const OpeningHours = require("opening_hours");

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass-api.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

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

// (1) Geocode an address using Nominatim.
async function geocodeAddress(address) {
  const q = String(address ?? "").trim();
  if (!q) {
    throw new Error("Address is required.");
  }

  const url =
    NOMINATIM_BASE_URL +
    `?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;

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

// (2) Opening hours parsing using `opening_hours` npm package.
function parseOpeningHours(raw) {
  if (!raw || typeof raw !== "string") {
    return {
      raw: null,
      is_open_now: null,
      status: "No data",
      next_change: null,
      error: null,
    };
  }

  try {
    const oh = new OpeningHours(raw);
    const now = new Date();
    const isOpen = oh.getState(now);
    let nextChange = null;
    try {
      nextChange = oh.getNextChange(now);
    } catch {
      nextChange = null;
    }

    return {
      raw,
      is_open_now: isOpen,
      status: isOpen ? "Open now" : "Closed",
      next_change: nextChange ? nextChange.toISOString() : null,
      error: null,
    };
  } catch (err) {
    return {
      raw,
      is_open_now: null,
      status: "No data",
      next_change: null,
      error: err && err.message ? err.message : String(err),
    };
  }
}

// (3) Map OSM amenity / feature tags to emoji icons.
function mapAmenitiesToIcons(tags = {}) {
  const icons = [];

  // Always show a coffee icon for cafes.
  icons.push("☕");

  const wifi = String(tags.wifi || tags.internet_access || "").toLowerCase();
  if (wifi === "yes" || wifi === "wlan" || wifi === "customers") {
    icons.push("📶");
  }

  if (String(tags.wheelchair).toLowerCase() === "yes") {
    icons.push("♿");
  }

  if (String(tags.outdoor_seating).toLowerCase() === "yes") {
    icons.push("🌳");
  }

  if (String(tags.takeaway).toLowerCase() === "yes") {
    icons.push("🥡");
  }

  if (String(tags.drive_through).toLowerCase() === "yes") {
    icons.push("🚗");
  }

  const cards = String(tags["payment:cards"] || "").toLowerCase();
  if (cards === "yes") {
    icons.push("💳");
  }

  const cuisine = String(tags.cuisine || "").toLowerCase();
  if (cuisine.includes("coffee")) {
    icons.push("☕");
  }

  const smoking = String(
    tags.smoking || tags["smoking:outside"] || ""
  ).toLowerCase();
  if (smoking && smoking !== "no") {
    icons.push("🚬");
  }

  // De-duplicate while preserving order.
  return [...new Set(icons)];
}

// Normalize a single Overpass node into our result shape.
function normalizeShopElement(el, userLat, userLon) {
  const tags = el.tags || {};
  const name = tags.name || "Coffee shop";

  const latitude = Number(el.lat);
  const longitude = Number(el.lon);

  const address = buildAddressFromTags(tags);
  let distance_m = null;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    distance_m = haversineDistanceMeters(userLat, userLon, latitude, longitude);
  }

  const openingHoursObj = parseOpeningHours(tags.opening_hours);
  const amenity_icons = mapAmenitiesToIcons(tags);

  return {
    id: el.id,
    name,
    latitude,
    longitude,
    address,
    tags,
    opening_hours: openingHoursObj,
    amenity_icons,
    source: "osm",
    distance_m,
  };
}

async function fetchOverpassJson(query) {
  const body = `data=${encodeURIComponent(query)}`;
  let lastError;

  for (const baseUrl of OVERPASS_URLS) {
    try {
      const res = await fetch(baseUrl, {
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
        // For overloaded servers (5xx / 429), try the next mirror.
        if (res.status >= 500 || res.status === 429) {
          lastError = new Error(
            `Overpass ${baseUrl} failed with status ${res.status}: ${text}`
          );
          continue;
        }
        throw new Error(
          `Overpass ${baseUrl} failed with status ${res.status}: ${text}`
        );
      }

      return await res.json();
    } catch (err) {
      // Network or parsing issue – remember and try the next mirror.
      lastError = err;
    }
  }

  // All mirrors failed.
  if (lastError) throw lastError;
  throw new Error("All Overpass API mirrors failed.");
}

// (4) Find nearby coffee shops around lat/lon using Overpass.
async function findNearbyCoffeeShops(lat, lon, radiusMeters = 1500) {
  const query = `[out:json][timeout:25];
node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
out;`;

  const data = await fetchOverpassJson(query);
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const results = elements
    .filter((el) => typeof el.lat === "number" && typeof el.lon === "number")
    .map((el) => normalizeShopElement(el, lat, lon));

  return {
    user: { lat, lon },
    results,
  };
}

// (5) Convenience: address → coordinates → nearby coffee shops (normalized).
async function findCoffeeShopsByAddress(address) {
  const { lat, lon } = await geocodeAddress(address);
  return await findNearbyCoffeeShops(lat, lon);
}

module.exports = {
  geocodeAddress,
  findNearbyCoffeeShops,
  findCoffeeShopsByAddress,
  mapAmenitiesToIcons,
  parseOpeningHours,
};

