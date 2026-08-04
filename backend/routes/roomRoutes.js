const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");

router.get("/available", roomController.getAvailableRooms);
router.post("/", roomController.createRoom);
router.get("/", roomController.getRooms);
router.put("/:id", roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);
module.exports = router;