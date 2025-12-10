const express = require('express');
const router = express.Router();
const { db } = require('../../../database/firebase'); // firebase.js ka path adjust karo
const { authMiddleware } = require('../../middleware/auth.middleware');



// helper: Firestore brand -> API brand
function mapBrand(doc) {
  const d = doc.data();

  return {
    id: doc.id,
    nameEn: d.nameEng || '',
    nameAr: d.nameArabic || '',
    phoneNumber: d.PhoneNumber || '',
    address: d.address || '',
    city: d.selectedCity || '',
    country: d.selectedCountry || '',
    category: d.selectedCategory || '',
    discountEn: d.discount || '',
    discountAr: d.discountArabic || '',
    image: d.img || '',
    menuUrl: d.menuUrl || '',
    pin: d.pin || '',
    status: d.status || '',
  };
}

function mapRedemption(doc) {
  const d = doc.data();

  return {
    id: doc.id,
    username: d.Username || '',
    brand: d.brand || '',
    code: d.code || '',
    percentage: d.percentage || '',
    phoneNumber: d.phoneNumber || '',
    date: d.date || '',
    brandId: d.brandId || '',
    Redeempin: d.Redeempin || '',
    // add if needed:
 
  };
}



// GET /api/brands -> sirf selected fields
router.get('/service', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('H-Brands').get();
    const brands = snapshot.docs.map(mapBrand);

    res.json(brands);
  } catch (err) {
    console.error('Error fetching brands:', err);
    res.status(500).json({ error: 'Failed to fetch brand data' });
  }
});


// GET /api/redemption -> selected fields only
router.get('/redemption', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('hala_redeemed_discounts').get();

    const redemptions = snapshot.docs.map(mapRedemption);

    res.json(redemptions);
  } catch (err) {
    console.error('Error fetching redemption:', err);
    res.status(500).json({ error: 'Failed to fetch redemption data' });
  }
});



// POST /api/brands/by-pin
// body: { "pin": "142774" }  ya  { "pin": "easypay" }
router.post('/vender', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required in body' });
    }

    let snapshot;

    // agar pin == 'easypay' -> sare records
    if (pin.toLowerCase() === 'easypay') {
      snapshot = await db.collection('H-Brands').get();
    } else {
      // warna sirf wo brand jiska pin match karta ho
      snapshot = await db
        .collection('H-Brands')
        .where('pin', '==', pin)
        .get();
    }

    const brands = snapshot.docs.map(mapBrand);

    return res.json(brands);
  } catch (err) {
    console.error('Error fetching brands by pin:', err);
    res.status(500).json({ error: 'Failed to fetch brand data by pin' });
  }
});


router.post('/vender/redemption', authMiddleware, async (req, res) => {
  try {
    const { brandId } = req.body;

    if (!brandId) {
      return res.status(400).json({ error: 'brandId is required in body' });
    }

    // get only by brandId
    const snapshot = await db
      .collection('hala_redeemed_discounts')
      .where('brandId', '==', brandId)
      .get();

    const redemptions = snapshot.docs.map(mapRedemption);

    return res.json(redemptions);
  } catch (err) {
    console.error('Error fetching redemption:', err);
    res.status(500).json({ error: 'Failed to fetch redemption data' });
  }
});





module.exports = router;





// GET All Data from fIREBASE AND stORE IN MongoDB





// // migrate-brands.js
// const express = require('express');
// const mongoose = require('mongoose');
// require('dotenv').config();

// const { db } = require('./src/database/firebase'); // <-- apna sahi path

// const app = express();
// app.use(express.json());

// // 1️⃣ MongoDB connection
// mongoose
//   .connect(process.env.MONGO_URI_HBS)
//   .then(() => {
//     console.log('✅ MongoDB connected');
//     console.log('🔎 DB Name:', mongoose.connection.name);
//     console.log('🔎 Host   :', mongoose.connection.host);
//   })
//   .catch((err) => {
//     console.error('MongoDB connection error:', err);
//     process.exit(1);
//   });

// /**
//  * 2️⃣ Brand Schema / Model
//  */
// const BrandSchema = new mongoose.Schema({}, { strict: false });
// // const Brand = mongoose.model('HBrand', BrandSchema, 'H-Brands');
// const Brand = mongoose.model('HVenues', BrandSchema, 'H-Venues');
// /**
//  * 3️⃣ Firestore doc -> plain object
//  */
// function mapFirestoreBrand(doc) {
//   const data = doc.data();

//   // Timestamp ko Date me convert kar do (agar ho)
//   let time = data.time;
//   if (time && typeof time.toDate === 'function') {
//     time = time.toDate();
//   }

//   return {
//     // yahan _id hata diya hai, taka Mongo khud generate kare
//     // _id: doc.id,
//     ...data,
//     time,
//   };
// }

// /**
//  * 4️⃣ Route: POST /api/migrate-brands
//  */
// app.post('/api/migrate-brands', async (req, res) => {
//   try {
//     console.log('🔄 Fetching brands from Firestore...');
//     const snapshot = await db.collection('H-Brands').get();

//     console.log('📊 snapshot.empty:', snapshot.empty);

//     if (snapshot.empty) {
//       return res.json({
//         success: true,
//         message: 'Firestore H-Brands collection is empty',
//         migrated: 0,
//       });
//     }

//     const brandsData = snapshot.docs.map(mapFirestoreBrand);

//     console.log(`📦 ${brandsData.length} brands fetched from Firestore`);
//     console.log('📝 Sample brand:', brandsData[0]); // sample after mapping

//     let successCount = 0;
//     let failCount = 0;

//     // 🔥 One-by-one save with detailed logging
//     for (let i = 0; i < brandsData.length; i++) {
//       const b = brandsData[i];
//       try {
//         await Brand.create(b);
//         successCount++;
//       } catch (err) {
//         failCount++;
//         console.error(`❌ Error saving doc #${i}:`, err.message);
//       }
//     }

//     console.log('✅ Successfully saved:', successCount);
//     console.log('❌ Failed to save:', failCount);

//     res.json({
//       success: true,
//       message: 'Brands migrated (per-document create)',
//       totalFromFirestore: brandsData.length,
//       saved: successCount,
//       failed: failCount,
//     });
//   } catch (err) {
//     console.error('❌ Error migrating brands:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to migrate brands',
//       error: err.message,
//     });
//   }
// });



// app.post('/api/migrate-brands1', async (req, res) => {
//   try {
//     console.log('🔄 Fetching H-Venues from Firestore...');
//     const snapshot = await db.collection('H-Venues').get();

//     console.log('📊 snapshot.empty:', snapshot.empty);

//     if (snapshot.empty) {
//       return res.json({
//         success: true,
//         message: 'Firestore H-Venuescollection is empty',
//         migrated: 0,
//       });
//     }

//     const brandsData = snapshot.docs.map(mapFirestoreBrand);

//     console.log(`📦 ${brandsData.length} brands fetched from Firestore`);
//     console.log('📝 Sample brand:', brandsData[0]); // sample after mapping

//     let successCount = 0;
//     let failCount = 0;

//     // 🔥 One-by-one save with detailed logging
//     for (let i = 0; i < brandsData.length; i++) {
//       const b = brandsData[i];
//       try {
//         await Brand.create(b);
//         successCount++;
//       } catch (err) {
//         failCount++;
//         console.error(`❌ Error saving doc #${i}:`, err.message);
//       }
//     }

//     console.log('✅ Successfully saved:', successCount);
//     console.log('❌ Failed to save:', failCount);

//     res.json({
//       success: true,
//       message: 'Brands migrated (per-document create)',
//       totalFromFirestore: brandsData.length,
//       saved: successCount,
//       failed: failCount,
//     });
//   } catch (err) {
//     console.error('❌ Error migrating brands:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to migrate brands',
//       error: err.message,
//     });
//   }
// });



// // 6️⃣ Start server
// const PORT = 4000;
// app.listen(PORT, () => {
//   console.log(`🚀 Migration server running on http://localhost:${PORT}`);
// });
