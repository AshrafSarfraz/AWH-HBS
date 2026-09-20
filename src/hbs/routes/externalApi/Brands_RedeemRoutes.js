// src/hbs/routes/externalApi/Brands_RedeemRoutes.js
//
// KYA BADLA:
//  - `/redemption` poori redeem history return karta tha — bina limit ke.
//    Ye collection roz barhti hai, is liye ye endpoint waqt ke saath saath
//    slow hota chala jata tha aur akhir me timeout karta. Ab pagination aur
//    date filter hai.
//  - `/vender/redemption` sirf `brandId` par query karta tha. Purana compound
//    index `{userId, brandId, date}` is query me kaam nahi aata tha (index ka
//    pehla field userId hai) → full collection scan. Ab `{brandId:1, date:-1}`
//    index hai (redeem.js me add kiya gaya).
//  - Venue lookup har request par DB se aata tha — ab 5 min cache.
//  - 500+ lines ka commented-out purana Firestore code hata diya.

const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../../middleware/auth.middleware");
const { HBS_DB } = require("../../../database/connect");
const Venue = require("../../models/venue");
const { TTLCache } = require("../../utils/ttlCache");
const {
  buildVenueLookup,
  resolveBrandCoordinates,
  isValidCoord,
} = require("../../utils/venueCoords");

const BRANDS_COL = "H-Brands";
const REDEMPTION_COL = "H-Redeem";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

const venueCache = new TTLCache({ ttl: 5 * 60_000, maxSize: 4 });

async function getVenueLookup() {
  const cached = venueCache.get("lookup");
  if (cached) return cached;
  const venues = await Venue.find({}).lean();
  return venueCache.set("lookup", buildVenueLookup(venues));
}

function pageParams(req) {
  const limit = Math.min(
    parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { limit, skip: (page - 1) * limit, page };
}

// ── Mappers ──────────────────────────────────────────────────────────

function mapBrand(doc) {
  return {
    id: doc._id?.toString() || "",
    nameEn: doc.nameEng || "",
    nameAr: doc.nameArabic || "",
    descriptionEn: doc.descriptionEng || "",
    descriptionAr: doc.descriptionArabic || "",
    phoneNumber: doc.PhoneNumber || "",
    address: doc.address || "",
    city: doc.selectedCity || "",
    country: doc.selectedCountry || "",
    category: doc.selectedCategory || "",
    longitude: doc.longitude || "",
    latitude: doc.latitude || "",
    selectedVenue: doc.selectedVenue || "",
    isVenue: Boolean(doc.isVenue),
    image: doc.img || "",
    pin: doc.pin || "",
    status: doc.status || "",
    discounts: Array.isArray(doc.discounts) ? doc.discounts : [],
  };
}

async function mapBrandsWithCoords(docs) {
  const venueLookup = await getVenueLookup(); // cached
  return docs.map((doc) => {
    const brand = mapBrand(doc);
    const { latitude, longitude } = resolveBrandCoordinates(doc, venueLookup);
    if (isValidCoord(latitude, longitude)) {
      brand.latitude = String(latitude);
      brand.longitude = String(longitude);
    }
    return brand;
  });
}

function mapRedemption(doc) {
  return {
    id: doc._id?.toString() || "",
    username: doc.Username || "",
    brand: doc.brand || "",
    code: doc.code || "",
    percentage: doc.percentage || "",
    phoneNumber: doc.phoneNumber || "",
    date: doc.date || "",
    brandId: doc.brandId || "",
    Redeempin: doc.Redeempin || "",
  };
}

// ── Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/hbs/service?page=1&limit=200&status=Active
 * Saare brands (paginated)
 */
router.get("/service", authMiddleware, async (req, res, next) => {
  try {
    const { limit, skip, page } = pageParams(req);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.city) filter.selectedCity = req.query.city;

    const docs = await HBS_DB.collection(BRANDS_COL)
      .find(filter)
      .skip(skip)
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const rows = hasMore ? docs.slice(0, limit) : docs;

    res.json({
      data: await mapBrandsWithCoords(rows),
      page,
      limit,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/hbs/redemption?page=1&limit=200&from=2026-01-01&to=2026-01-31
 * ⚠️ `from`/`to` zaroor bhejein — warna sab records scan honge.
 */
router.get("/redemption", authMiddleware, async (req, res, next) => {
  try {
    const { limit, skip, page } = pageParams(req);

    const filter = {};
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = String(req.query.from);
      if (req.query.to) filter.date.$lte = String(req.query.to);
    }

    const docs = await HBS_DB.collection(REDEMPTION_COL)
      .find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const rows = hasMore ? docs.slice(0, limit) : docs;

    res.json({ data: rows.map(mapRedemption), page, limit, hasMore });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/hbs/vender     body: { pin: "917954" } ya { pin: "easypay" }
 */
router.post("/vender", authMiddleware, async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "pin is required in body" });

    const isMaster = String(pin).toLowerCase() === "easypay";
    const { limit, skip, page } = pageParams(req);

    const query = isMaster ? {} : { pin: String(pin) };

    const cursor = HBS_DB.collection(BRANDS_COL).find(query);
    // Master pin sab brands laata hai — usay paginate karo
    if (isMaster) cursor.skip(skip).limit(limit + 1);

    const docs = await cursor.toArray();
    const hasMore = isMaster && docs.length > limit;
    const rows = hasMore ? docs.slice(0, limit) : docs;

    res.json({ data: await mapBrandsWithCoords(rows), page, limit, hasMore });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/hbs/vender/redemption
 * body: { brandId, from?, to? }   query: ?page=1&limit=200
 */
router.post("/vender/redemption", authMiddleware, async (req, res, next) => {
  try {
    const { brandId, from, to } = req.body;
    if (!brandId) {
      return res.status(400).json({ error: "brandId is required in body" });
    }

    const { limit, skip, page } = pageParams(req);

    const filter = { brandId: String(brandId) };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = String(from);
      if (to) filter.date.$lte = String(to);
    }

    const docs = await HBS_DB.collection(REDEMPTION_COL)
      .find(filter)
      .sort({ date: -1 }) // { brandId:1, date:-1 } index isay cover karta hai
      .skip(skip)
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const rows = hasMore ? docs.slice(0, limit) : docs;

    res.json({ data: rows.map(mapRedemption), page, limit, hasMore });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
