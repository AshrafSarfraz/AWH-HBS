/**
 * Known coordinates for venues that may be missing lat/lng in MongoDB
 * (legacy records created before coordinates were required).
 */
const VENUE_COORDINATES_BY_NAME = {
  "west walk": { latitude: 25.2524385, longitude: 51.462465 },
  katara: { latitude: 25.3608802, longitude: 51.504496 },
  "festival city": { latitude: 25.385584, longitude: 51.443192 },
  "place vendôme": { latitude: 25.405, longitude: 51.518 },
  "place vendome": { latitude: 25.405, longitude: 51.518 },
  "district 1 & 2": { latitude: 26.2185, longitude: 50.4805 },
  "al liwan": { latitude: 26.1078, longitude: 50.5122 },
  "the village": { latitude: 26.2573, longitude: 50.6125 },
  riffa: { latitude: 26.1304, longitude: 50.555 },
  "gardenia walk": { latitude: 26.4367, longitude: 50.1039 },
};

const normalizeName = (name) =>
  (name || "").trim().toLowerCase().replace(/\s+/g, " ");

const isValidCoord = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

const parseCoord = (value) => {
  if (value == null || value === "") return NaN;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Resolve lat/lng for a venue document, using DB values or known fallbacks.
 */
function resolveVenueCoordinates(venue) {
  let latitude = parseCoord(venue?.latitude);
  let longitude = parseCoord(venue?.longitude);

  if (!isValidCoord(latitude, longitude)) {
    const fallback =
      VENUE_COORDINATES_BY_NAME[normalizeName(venue?.venueName)] ||
      VENUE_COORDINATES_BY_NAME[normalizeName(venue?.venueNameAr)];
    if (fallback) {
      latitude = fallback.latitude;
      longitude = fallback.longitude;
    }
  }

  return { latitude, longitude };
}

/**
 * Build lookup maps from venue list for resolving brand selectedVenue.
 */
function buildVenueLookup(venues) {
  const byId = new Map();
  const byName = new Map();

  for (const venue of venues) {
    const { latitude, longitude } = resolveVenueCoordinates(venue);
    if (!isValidCoord(latitude, longitude)) continue;

    const coords = { latitude, longitude };
    const id = venue._id?.toString();
    if (id) byId.set(id, coords);

    const name = normalizeName(venue.venueName);
    if (name) byName.set(name, coords);

    const nameAr = normalizeName(venue.venueNameAr);
    if (nameAr) byName.set(nameAr, coords);
  }

  return { byId, byName };
}

/**
 * Resolve brand coordinates from its own lat/lng or linked selectedVenue.
 */
function resolveBrandCoordinates(brand, venueLookup) {
  let latitude = parseCoord(brand?.latitude);
  let longitude = parseCoord(brand?.longitude);

  if (!isValidCoord(latitude, longitude) && brand?.selectedVenue) {
    const key = normalizeName(brand.selectedVenue);
    const fromVenue =
      venueLookup.byId.get(brand.selectedVenue) ||
      venueLookup.byName.get(key) ||
      VENUE_COORDINATES_BY_NAME[key];

    if (fromVenue) {
      latitude = fromVenue.latitude;
      longitude = fromVenue.longitude;
    }
  }

  return { latitude, longitude };
}

/**
 * Attach resolved coordinates to a venue object for API responses.
 */
function withResolvedVenueCoords(venue) {
  const doc = venue?.toObject ? venue.toObject() : { ...venue };
  const { latitude, longitude } = resolveVenueCoordinates(doc);
  if (isValidCoord(latitude, longitude)) {
    doc.latitude = latitude;
    doc.longitude = longitude;
  }
  return doc;
}

module.exports = {
  VENUE_COORDINATES_BY_NAME,
  isValidCoord,
  resolveVenueCoordinates,
  buildVenueLookup,
  resolveBrandCoordinates,
  withResolvedVenueCoords,
};
