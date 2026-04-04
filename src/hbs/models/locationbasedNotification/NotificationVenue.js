const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: false,
      default: null,
      index: true,
    },

    token: {
      type: String,
      index: true,
      required: true,
      trim: true,
    },

    title: { type: String, default: "" },
    body: { type: String, default: "" },

    screen: { type: String, default: "SelectedVenue" },

    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      default: null,
      index: true,
    },

    userLatitude: Number,
    userLongitude: Number,
    venueLatitude: Number,
    venueLongitude: Number,

    distanceMeters: Number,

    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      default: "SENT",
      index: true,
    },

    fcmResponse: { type: Object, default: {} },
    errorMessage: { type: String, default: "" },
  },
  {
    collection: "H-NotificationVenue",
    timestamps: true,
  }
);

module.exports =
  HBS_DB.models.Notification ||
  HBS_DB.model("Notification", notificationSchema);








// const mongoose = require("mongoose");
// const { HBS_DB } = require("../../../database/connect");
// const notificationSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: String,
//       required: true,
//       index: true,
//     },

//     token: {
//       type: String,
//       index: true,
//       required: true,
//     },

//     title: { type: String, default: "" },
//     body: { type: String, default: "" },

//     screen: { type: String, default: "SelectedVenue" },

//     venueId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Venue",
//       default: null,
//       index: true,
//     },

//     userLatitude: Number,
//     userLongitude: Number,
//     venueLatitude: Number,
//     venueLongitude: Number,

//     distanceMeters: Number,

//     status: {
//       type: String,
//       enum: ["SENT", "FAILED"],
//       default: "SENT",
//       index: true,
//     },

//     fcmResponse: { type: Object, default: {} },
//     errorMessage: { type: String, default: "" },
//   },
//   {
//     collection: "H-NotificationVenue",
//     timestamps: true,
//   }
// );

// // ✅ important: avoid model overwrite error
// module.exports =
//   HBS_DB.model("Notification", notificationSchema);
