const express = require("express");
const router = express.Router();
const ctrl = require("../controller/managerController");

router.get("/", ctrl.listManagers);
router.post("/", ctrl.createManager);
router.put("/:id", ctrl.updateManager);
router.delete("/:id", ctrl.deleteManager);

module.exports = router;
