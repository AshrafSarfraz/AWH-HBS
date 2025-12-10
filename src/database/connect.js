const mongoose = require("mongoose");

// 1st DB Connection (HR)
const HR_DB = mongoose.createConnection(process.env.MONGO_URI, {

});

// 2nd DB Connection (HBS)
const HBS_DB = mongoose.createConnection(process.env.MONGO_URI_HBS, {

});


// Example: schema create karo
const HrUser = HR_DB.model("HrUser", new mongoose.Schema({
  name: String,
}));

const HbsUser = HBS_DB.model("HbsUser", new mongoose.Schema({
  name: String,
}));

module.exports = { HR_DB, HBS_DB, HrUser, HbsUser };








