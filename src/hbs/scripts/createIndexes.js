#!/usr/bin/env node
// scripts/createIndexes.js
//
// Naye indexes live database par banata hai.
//
//   node scripts/createIndexes.js
//
// Mongoose khud bhi autoIndex se banata hai, lekin production me wo slow aur
// ghair-yaqeeni hai. Yeh script background me index banati hai — DB block
// nahi hota, app chalti rehti hai.
//
// Bilkul mehfooz hai: agar index pehle se mojood ho to MongoDB usay chhor deta
// hai. Ek se zyada baar chala sakte hain.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");

const INDEXES = [
  // ── Chat ke messages (SABSE ZAROORI) ───────────────────────────────
  { col: "messages", spec: { chat: 1, createdAt: -1 } },
  { col: "messages", spec: { chat: 1, sender: 1, status: 1 } },
  { col: "messages", spec: { sender: 1, status: 1, chat: 1 } },
  { col: "messages", spec: { chat: 1, mediaType: 1, createdAt: -1 } },

  // ── Chats ──────────────────────────────────────────────────────────
  { col: "chats", spec: { participants: 1, lastMessageAt: -1 } },

  // ── Users ──────────────────────────────────────────────────────────
  { col: "Users", spec: { name: 1 } },

  // ── Brands ─────────────────────────────────────────────────────────
  { col: "H-Brands", spec: { status: 1, time: -1 } },
  { col: "H-Brands", spec: { selectedCity: 1, status: 1 } },
  { col: "H-Brands", spec: { selectedCategory: 1, status: 1 } },
  { col: "H-Brands", spec: { pin: 1 } },
  { col: "H-Brands", spec: { selectedVenue: 1 } },

  // ── Redeem ─────────────────────────────────────────────────────────
  { col: "H-Redeem", spec: { brandId: 1, date: -1 } },
  { col: "H-Redeem", spec: { userId: 1, date: -1 } },
  { col: "H-Redeem", spec: { createdAt: -1 } },
];

function indexName(spec) {
  return Object.entries(spec)
    .map(([k, v]) => `${k}_${v}`)
    .join("_");
}

(async () => {
  const uri = process.env.MONGO_URI_HBS;
  if (!uri) {
    console.error("❌ MONGO_URI_HBS .env me set nahi hai");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(uri).asPromise();
  console.log(`📦 Connected to: ${conn.name}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { col, spec } of INDEXES) {
    const name = indexName(spec);
    try {
      // background: true → index banate waqt collection lock nahi hota
      await conn.db.collection(col).createIndex(spec, {
        name,
        background: true,
      });
      console.log(`✅ ${col.padEnd(12)} ${name}`);
      created++;
    } catch (err) {
      if (err.codeName === "IndexOptionsConflict" || err.code === 85) {
        console.log(`⏭️  ${col.padEnd(12)} ${name} (pehle se mojood)`);
        skipped++;
      } else {
        console.error(`❌ ${col.padEnd(12)} ${name} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);

  // Mojooda indexes dikhao
  console.log(`\n📋 Messages collection ke indexes:`);
  try {
    const idx = await conn.db.collection("messages").indexes();
    idx.forEach((i) => console.log(`   ${i.name}`));
  } catch {
    console.log("   (collection abhi mojood nahi)");
  }

  await conn.close();
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
