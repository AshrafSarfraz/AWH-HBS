// src/hbs/controllers/brandController.js
//
// KYA BADLA:
//  - `getBrands` par pagination (pehle saare brands ek saath, sab fields ke
//    saath, bina .lean() ke). App ka home screen isi par chalta hai.
//  - Venue lookup ab 5 minute cache hota hai — pehle HAR brand request par
//    poori `Venue.find({})` chalti thi.
//  - Images ab compress ho kar upload hoti hain (mediaUpload utility).
//  - `?fields=list` bhejne par sirf list ke liye zaroori fields aate hain —
//    payload ~70% chhota ho jata hai.

const Brand = require("../models/brands");
const Venue = require("../models/venue");
const { uploadMediaBuffer } = require("../utils/mediaUpload");
const { TTLCache } = require("../utils/ttlCache");
const {
  buildVenueLookup,
  resolveBrandCoordinates,
  isValidCoord,
} = require("../utils/venueCoords");

const MAX_BRAND_PAGE = 100;

// Venues shaz-o-naadir badalte hain — 5 min cache bilkul mehfooz hai
const venueCache = new TTLCache({ ttl: 5 * 60_000, maxSize: 4 });

async function getVenueLookup() {
  const cached = venueCache.get("lookup");
  if (cached) return cached;
  const venues = await Venue.find({}).lean();
  return venueCache.set("lookup", buildVenueLookup(venues));
}

/** Naya venue banne/badalne par isay call karein */
function invalidateVenueCache() {
  venueCache.delete("lookup");
}

// List view ke liye chhota projection
const LIST_FIELDS =
  "nameEng nameArabic img heroImage discounts isFlatOffer isBestSeller " +
  "selectedCategory selectedCity selectedCountry selectedVenue status " +
  "latitude longitude address time";

function attachCoords(doc, venueLookup) {
  const { latitude, longitude } = resolveBrandCoordinates(doc, venueLookup);
  if (isValidCoord(latitude, longitude)) {
    doc.latitude = String(latitude);
    doc.longitude = String(longitude);
  }
  return doc;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/hbs/brands?status=Active&city=Riyadh&page=1&limit=30&fields=list
// ─────────────────────────────────────────────────────────────────────
exports.getBrands = async (req, res, next) => {
  try {
    const { status, city, country, category, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (city) filter.selectedCity = city;
    if (country) filter.selectedCountry = country;
    if (category) filter.selectedCategory = category;
    if (search && search.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.nameEng = { $regex: `^${safe}`, $options: "i" };
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, MAX_BRAND_PAGE);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const projection = req.query.fields === "list" ? LIST_FIELDS : null;

    const [brands, venueLookup, total] = await Promise.all([
      Brand.find(filter, projection)
        .sort({ time: -1 })
        .skip((page - 1) * limit)
        .limit(limit + 1)
        .lean(),
      getVenueLookup(),
      page === 1 ? Brand.countDocuments(filter) : Promise.resolve(null),
    ]);

    const hasMore = brands.length > limit;
    const pageBrands = hasMore ? brands.slice(0, limit) : brands;

    res.json({
      success: true,
      data: pageBrands.map((b) => attachCoords(b, venueLookup)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total == null ? null : Math.ceil(total / limit),
        hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/hbs/brands/:id
// ─────────────────────────────────────────────────────────────────────
exports.getBrandById = async (req, res, next) => {
  try {
    const [brand, venueLookup] = await Promise.all([
      Brand.findById(req.params.id).lean(),
      getVenueLookup(),
    ]);

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.json({ success: true, data: attachCoords(brand, venueLookup) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Helpers for create/update
// ─────────────────────────────────────────────────────────────────────
function parseMaybeJson(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

const toBool = (v) => v === true || v === "true";

async function uploadBrandAssets(files = {}) {
  // Sab uploads parallel — pehle ek ke baad ek hote the
  const [img, hero, pdf, gallery] = await Promise.all([
    files.img?.[0]
      ? uploadMediaBuffer({ ...files.img[0], folder: "brands/logos", makeThumbnail: false })
      : null,
    files.heroImage?.[0]
      ? uploadMediaBuffer({ ...files.heroImage[0], folder: "brands/hero", makeThumbnail: false })
      : null,
    files.pdf?.[0]
      ? uploadMediaBuffer({ ...files.pdf[0], folder: "brands/menus", makeThumbnail: false })
      : null,
    files.gallery?.length
      ? Promise.all(
          files.gallery.map((f) =>
            uploadMediaBuffer({ ...f, folder: "brands/gallery", makeThumbnail: false })
          )
        )
      : null,
  ]);

  return {
    img: img?.mediaUrl || null,
    heroImage: hero?.mediaUrl || null,
    pdfUrl: pdf?.mediaUrl || null,
    gallery: gallery ? gallery.map((g) => g.mediaUrl) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/hbs/brands
// ─────────────────────────────────────────────────────────────────────
exports.createBrand = async (req, res, next) => {
  try {
    const body = req.body;
    const assets = await uploadBrandAssets(req.files || {});

    const brand = await Brand.create({
      nameEng: body.nameEng,
      nameArabic: body.nameArabic,
      discounts: parseMaybeJson(body.discounts) || [],
      discountUsageMode: body.discountUsageMode || "one-per-day",
      vendorGroupId: body.vendorGroupId,
      isFlatOffer: toBool(body.isFlatOffer),
      descriptionEng: body.descriptionEng,
      descriptionArabic: body.descriptionArabic,
      PhoneNumber: body.PhoneNumber,
      longitude: body.longitude,
      latitude: body.latitude,
      address: body.address,
      menuUrl: body.menuUrl,
      timings: parseMaybeJson(body.timings) || null,
      startAt: body.startAt,
      endAt: body.endAt,
      selectedCategory: body.selectedCategory,
      pin: body.pin,
      isBestSeller: toBool(body.isBestSeller),
      isVenue: toBool(body.isVenue),
      selectedCity: body.selectedCity,
      selectedCountry: body.selectedCountry,
      selectedVenue: body.selectedVenue,
      status: body.status || "Active",
      img: assets.img,
      heroImage: assets.heroImage,
      pdfUrl: assets.pdfUrl,
      multiImageUrls: assets.gallery || [],
    });

    res.status(201).json({ success: true, data: brand });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// PUT /api/hbs/brands/:id
// ─────────────────────────────────────────────────────────────────────
exports.updateBrand = async (req, res, next) => {
  try {
    const body = req.body;

    const updatableFields = [
      "nameEng", "nameArabic", "discountUsageMode", "vendorGroupId",
      "descriptionEng", "descriptionArabic", "PhoneNumber", "longitude",
      "latitude", "address", "menuUrl", "startAt", "endAt",
      "selectedCategory", "pin", "selectedCity", "selectedCountry",
      "selectedVenue", "status",
    ];

    const $set = {};
    for (const f of updatableFields) {
      if (body[f] !== undefined) $set[f] = body[f];
    }
    if (body.isFlatOffer !== undefined) $set.isFlatOffer = toBool(body.isFlatOffer);
    if (body.isBestSeller !== undefined) $set.isBestSeller = toBool(body.isBestSeller);
    if (body.isVenue !== undefined) $set.isVenue = toBool(body.isVenue);

    const discounts = parseMaybeJson(body.discounts);
    if (discounts !== undefined) $set.discounts = discounts;

    const timings = parseMaybeJson(body.timings);
    if (timings !== undefined) $set.timings = timings;

    const assets = await uploadBrandAssets(req.files || {});
    if (assets.img) $set.img = assets.img;
    if (assets.heroImage) $set.heroImage = assets.heroImage;
    if (assets.pdfUrl) $set.pdfUrl = assets.pdfUrl;
    if (assets.gallery) $set.multiImageUrls = assets.gallery;

    // Pehle findById → fields set → save() (2 round trips). Ab 1.
    const updated = await Brand.findByIdAndUpdate(
      req.params.id,
      { $set },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/hbs/brands/:id
// ─────────────────────────────────────────────────────────────────────
exports.deleteBrand = async (req, res, next) => {
  try {
    const deleted = await Brand.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.json({ success: true, message: "Brand deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.invalidateVenueCache = invalidateVenueCache;
