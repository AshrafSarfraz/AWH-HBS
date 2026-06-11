const express = require('express');
const router = express.Router();
const sql = require('mssql');
const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();
const { HR_DB } = require('../database/connect');



const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};

const employeeSchema = new mongoose.Schema({}, { collection: 'employees', strict: false });
const Employee = HR_DB.model('Employee', employeeSchema);

// async function syncEmployees() {
//   const pool = await sql.connect(sqlConfig);
//   const result = await pool.request().query('SELECT * FROM EmployeeData');
//   await Employee.deleteMany({});
//   await Employee.insertMany(result.recordset);
//   console.log(`✅ Synced ${result.recordset.length} employees`);
// }

// function startEmployeeCron() {
//   cron.schedule('0 22 * * *', syncEmployees, { timezone: 'Asia/Qatar' });
// }


async function syncEmployees() {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query('SELECT * FROM EmployeeData');

    const data = result.recordset;

    if (!data.length) {
      console.log("⚠️ No data from SQL, skipping sync");
      return;
    }

    await Employee.deleteMany({});
    await Employee.insertMany(data);

    console.log(`✅ Synced ${data.length} employees`);
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
  }
}

function startEmployeeCron() {
  cron.schedule('0 2 * * *', async () => {
    console.log("Daily sync running...");
    await syncEmployees();
  }, { timezone: 'Asia/Qatar' });
}

router.get('/employees', async (req, res) => {
  const pool = await sql.connect(sqlConfig);
  const result = await pool.request().query('SELECT * FROM EmployeeData');
  res.json(result.recordset);
});

router.get('/employees/mongo', async (req, res) => {
  const docs = await Employee.find();
  res.json(docs);
});

router.post('/employees/sync', async (req, res) => {
  await syncEmployees();
  res.send('✅ Manual sync complete');
});



router.get('/employees/check-email', async (req, res) => {
  try {
    const missing = await Employee.find({
      $or: [{ Email: null }, { Email: '' }, { Email: { $exists: false } }]
    });
    console.log(missing.length, 'employees without email');
    res.json({ count: missing.length, employees: missing });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
router.get('/employees/debug/:id', async (req, res) => {
  const docs = await Employee.find({ EmployeeCode: req.params.id });
  res.json(docs);
});
module.exports = { router, startEmployeeCron, syncEmployees};
