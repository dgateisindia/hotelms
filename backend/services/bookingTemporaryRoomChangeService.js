const {
  startTemporaryRoomChange,
} = require("./booking/room-change/temporaryMoveService");

const {
  markOriginalRoomReady,
} = require("./booking/room-change/originalRoomReadyService");

const {
  returnToOriginalRoom,
} = require("./booking/room-change/returnOriginalRoomService");

module.exports = {
  startTemporaryRoomChange,
  markOriginalRoomReady,
  returnToOriginalRoom,
};