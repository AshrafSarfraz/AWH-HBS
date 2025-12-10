const express = require('express');
const router = express.Router();
const sql = require('mssql');
const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();
const { HR_DB } = require('../database/connect');



const sqlConfig = {
  user: 'AlWessil',
  password: 'P@ssw0rd1',
  server: '10.1.1.103',
  database: 'EmployeeDB',
  options: { encrypt: false, trustServerCertificate: true }
};

const employeeSchema = new mongoose.Schema({}, { collection: 'employees', strict: false });
const Employee = HR_DB.model('Employee', employeeSchema);

async function syncEmployees() {
  const pool = await sql.connect(sqlConfig);
  const result = await pool.request().query('SELECT * FROM EmployeeData');
  await Employee.deleteMany({});
  await Employee.insertMany(result.recordset);
  console.log(`✅ Synced ${result.recordset.length} employees`);
}

function startEmployeeCron() {
  cron.schedule('0 22 * * *', syncEmployees, { timezone: 'Asia/Qatar' });
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

module.exports = { router, startEmployeeCron };
