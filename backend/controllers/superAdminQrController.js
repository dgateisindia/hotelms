"use strict";

const db = require("../config/db").promisePool;

async function getSelectedHotelQrOverview(req, res) {
  const ownerId = Number(req.dbUser?.superadminId);

  if (
    req.dbUser?.role !== "super_admin" ||
    !Number.isSafeInteger(ownerId) ||
    ownerId <= 0
  ) {
    return res.status(403).json({
      success: false,
      message: "Super Admin access required.",
    });
  }

  const match = /^HT-([0-9]{4,})$/.exec(
    String(req.params?.hotelDisplayId || "")
  );

  const hotelId = match ? Number(match[1]) : NaN;

  if (
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid hotel ID.",
    });
  }

  try {
    const [hotels] = await db.query(
      `
        SELECT hotel_id, hotel_name, status
        FROM hotels
        WHERE hotel_id = ?
          AND superadmin_id = ?
        LIMIT 1
      `,
      [hotelId, ownerId]
    );

    if (hotels.length !== 1) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found in your portfolio.",
      });
    }

    const [qrRows] = await db.query(
      `
        SELECT
          qr.qr_id,
          qr.status,
          qr.public_token
        FROM qr_codes qr
        INNER JOIN hotels h
          ON h.hotel_id = qr.hotel_id
        WHERE qr.hotel_id = ?
          AND h.superadmin_id = ?
        ORDER BY qr.qr_id DESC
        LIMIT 1
      `,
      [hotelId, ownerId]
    );

    const hotel = hotels[0];
    const qr = qrRows[0] || null;

    const configured = Boolean(qr);
    const qrStatus = qr ? qr.status : "not_configured";

    const publicToken = qr
      ? String(qr.public_token || "").trim()
      : "";

    const enabled =
      hotel.status === "active" &&
      qrStatus === "active" &&
      publicToken.length === 64;

    return res.status(200).json({
      success: true,
      data: {
        hotel: {
          displayId:
            `HT-${String(hotelId).padStart(4, "0")}`,
          name: hotel.hotel_name,
          status: hotel.status,
        },
        qr: {
          configured,
          status: qrStatus,
          enabled,
          publicToken: enabled ? publicToken : null,
        },
      },
    });
  } catch (error) {
    console.error(
      "[SUPER_ADMIN_QR_OVERVIEW]",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Hotel QR overview unavailable.",
    });
  }
}

module.exports = {
  getSelectedHotelQrOverview,
};