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
  const now = new Date();

  // Fallback assumption window: 10:00–19:00 local system time
  const assumedOpenStart = 10;
  const assumedOpenEnd = 19;
  const currentHour = now.getHours();

  const assumeOpen = currentHour >= assumedOpenStart && currentHour < assumedOpenEnd;

  // If missing or empty → use fallback assumption
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return {
      raw: null,
      is_open_now: assumeOpen,
      status: assumeOpen ? "Open" : "Closed",
      next_change: null,
      error: "No opening_hours tag",
      assumed: true, // <-- add this field so frontend can show tooltip
    };
  }

  // Try real parsing
  try {
    const oh = new OpeningHours(raw);
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
      assumed: false,
    };
  } catch (err) {
    // If parsing fails → still fallback to assumption
    return {
      raw,
      is_open_now: assumeOpen,
      status: assumeOpen ? "Open (assumed)" : "Closed (assumed)",
      next_change: null,
      error: err?.message || String(err),
      assumed: true,
    };
  }
}


// (3) Map OSM amenity / feature tags to emoji icons.
function iconWithTooltip(icon, tip) {
  return `<span class="amenity tooltip" data-tip="${tip}">${icon}</span>`;
}

function mapAmenitiesToIcons(tags = {}) {
  const icons = [];

  // Always show a coffee icon for cafes.
  icons.push(iconWithTooltip("☕", "Coffee shop"));

  const wifi = String(tags.wifi || tags.internet_access || "").toLowerCase();
  if (wifi === "yes" || wifi === "wlan" || wifi === "customers") {
    icons.push(iconWithTooltip("📶", "Free WiFi"));
  }

  if (String(tags.wheelchair).toLowerCase() === "yes") {
    icons.push(iconWithTooltip("♿", "Wheelchair accessible"));
  }

  if (String(tags.outdoor_seating).toLowerCase() === "yes") {
    icons.push(iconWithTooltip("🌳", "Outdoor seating"));
  }

  if (String(tags.takeaway).toLowerCase() === "yes") {
    icons.push(iconWithTooltip("🥡", "Takeaway available"));
  }

  if (String(tags.drive_through).toLowerCase() === "yes") {
    icons.push(iconWithTooltip("🚗", "Drive-through available"));
  }

  const cards = String(tags["payment:cards"] || "").toLowerCase();
  if (cards === "yes") {
    icons.push(iconWithTooltip("💳", "Credit cards accepted"));
  }

  // const cuisine = String(tags.cuisine || "").toLowerCase();
  // if (cuisine.includes("coffee")) {
  //   icons.push("☕");
  // }

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
  let amenity_icons = mapAmenitiesToIcons(tags);

  // Add “assumed hours” icon
  if (openingHoursObj.assumed) {
    amenity_icons.push(iconWithTooltip("❓", "Assumed opening hours"));
  }

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

