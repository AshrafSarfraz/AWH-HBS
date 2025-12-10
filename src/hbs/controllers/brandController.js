const Brand = require("../models/brands");
const { uploadToFirebase } = require("../utils/firebaseupload");

/**
 * CREATE Brand
 * POST /api/brands
 */
exports.createBrand = async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || {};

    // 1) Upload files to Firebase
    const imgUrl = files.img
      ? await uploadToFirebase(files.img[0], "brands/logos")
      : null;

    const heroImageUrl = files.heroImage
      ? await uploadToFirebase(files.heroImage[0], "brands/hero")
      : null;

    const pdfUrl = files.pdf
      ? await uploadToFirebase(files.pdf[0], "brands/menus")
      : null;

    let galleryUrls = [];
    if (files.gallery && files.gallery.length > 0) {
      galleryUrls = await Promise.all(
        files.gallery.map((file) =>
          uploadToFirebase(file, "brands/gallery")
        )
      );
    }

    // 2) discounts (string ya direct array dono handle)
    let discounts = [];
    if (body.discounts) {
      discounts =
        typeof body.discounts === "string"
          ? JSON.parse(body.discounts)
          : body.discounts;
    }

    // 3) timings (string ya object dono handle)
    let timings = null;
    if (body.timings) {
      timings =
        typeof body.timings === "string"
          ? JSON.parse(body.timings)
          : body.timings;
    }

    // 4) Brand document create
    const brand = new Brand({
      nameEng: body.nameEng,
      nameArabic: body.nameArabic,

      discounts,
      discountUsageMode: body.discountUsageMode || "one-per-day",

      vendorGroupId: body.vendorGroupId,
      isFlatOffer: body.isFlatOffer === "true" || body.isFlatOffer === true,

      descriptionEng: body.descriptionEng,
      descriptionArabic: body.descriptionArabic,

      PhoneNumber: body.PhoneNumber,
      longitude: body.longitude,
      latitude: body.latitude,
      address: body.address,
      menuUrl: body.menuUrl,

      timings,

      startAt: body.startAt,
      endAt: body.endAt,

      selectedCategory: body.selectedCategory,
      pin: body.pin,

      isBestSeller:
        body.isBestSeller === "true" || body.isBestSeller === true,
      isVenue: body.isVenue === "true" || body.isVenue === true,

      selectedCity: body.selectedCity,
      selectedCountry: body.selectedCountry,
      selectedVenue: body.selectedVenue,

      status: body.status || "Active",

      img: imgUrl,
      pdfUrl: pdfUrl,
      multiImageUrls: galleryUrls,
      heroImage: heroImageUrl,
    });

    const saved = await brand.save();

    return res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    console.error("createBrand error:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating brand",
      error: err.message,
    });
  }
};

/**
 * GET all brands
 * GET /api/brands
 */
exports.getBrands = async (req, res) => {
  try {
    const { status, city, country, category } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (city) filter.selectedCity = city;
    if (country) filter.selectedCountry = country;
    if (category) filter.selectedCategory = category;

    const brands = await Brand.find(filter).sort({ time: -1 });

    return res.json({
      success: true,
      data: brands,
    });
  } catch (err) {
    console.error("getBrands error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching brands",
      error: err.message,
    });
  }
};

/**
 * GET single brand by id
 * GET /api/brands/:id
 */
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.json({
      success: true,
      data: brand,
    });
  } catch (err) {
    console.error("getBrandById error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching brand",
      error: err.message,
    });
  }
};

/**
 * UPDATE brand
 * PUT /api/brands/:id
 */
exports.updateBrand = async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || {};

    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // updatable fields
    const updatableFields = [
      "nameEng",
      "nameArabic",
      "discountUsageMode",
      "vendorGroupId",
      "descriptionEng",
      "descriptionArabic",
      "PhoneNumber",
      "longitude",
      "latitude",
      "address",
      "menuUrl",
      "startAt",
      "endAt",
      "selectedCategory",
      "pin",
      "selectedCity",
      "selectedCountry",
      "selectedVenue",
      "status",
    ];

    updatableFields.forEach((field) => {
      if (body[field] !== undefined) {
        brand[field] = body[field];
      }
    });

    if (body.isFlatOffer !== undefined) {
      brand.isFlatOffer =
        body.isFlatOffer === "true" || body.isFlatOffer === true;
    }

    if (body.isBestSeller !== undefined) {
      brand.isBestSeller =
        body.isBestSeller === "true" || body.isBestSeller === true;
    }

    if (body.isVenue !== undefined) {
      brand.isVenue = body.isVenue === "true" || body.isVenue === true;
    }

    // discounts update
    if (body.discounts !== undefined) {
      brand.discounts =
        typeof body.discounts === "string"
          ? JSON.parse(body.discounts)
          : body.discounts;
    }

    // timings update
    if (body.timings !== undefined) {
      brand.timings =
        typeof body.timings === "string"
          ? JSON.parse(body.timings)
          : body.timings;
    }

    // FILES
    if (files.img && files.img[0]) {
      brand.img = await uploadToFirebase(files.img[0], "brands/logos");
    }

    if (files.heroImage && files.heroImage[0]) {
      brand.heroImage = await uploadToFirebase(
        files.heroImage[0],
        "brands/hero"
      );
    }

    if (files.pdf && files.pdf[0]) {
      brand.pdfUrl = await uploadToFirebase(files.pdf[0], "brands/menus");
    }

    if (files.gallery && files.gallery.length > 0) {
      const galleryUrls = await Promise.all(
        files.gallery.map((file) =>
          uploadToFirebase(file, "brands/gallery")
        )
      );
      brand.multiImageUrls = galleryUrls;
    }

    const updated = await brand.save();

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("updateBrand error:", err);
    return res.status(500).json({
      success: false,
      message: "Error updating brand",
      error: err.message,
    });
  }
};

/**
 * DELETE brand
 * DELETE /api/brands/:id
 */
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // Optional: Firebase se images/pdfs delete karna ho to yahan logic likh sakte ho

    return res.json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (err) {
    console.error("deleteBrand error:", err);
    return res.status(500).json({
      success: false,
      message: "Error deleting brand",
      error: err.message,
    });
  }
};
