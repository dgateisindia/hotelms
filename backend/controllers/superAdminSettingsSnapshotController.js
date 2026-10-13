"use strict";

const db = require("../config/db").promisePool;

function previewValue(row) {
  const key = String(row.settingKey || "");

  if (/password|secret|token|credential|api[_-]?key/i.test(key)) {
    return "Hidden";
  }

  if (row.dataType === "object" || row.dataType === "array") {
    return "Structured policy";
  }

  const raw = row.settingValue;

  if (raw === null || raw === undefined) {
    return "Not configured";
  }

  let parsed = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (parsed === null || parsed === undefined) {
    return "Not configured";
  }

  if (typeof parsed === "object") {
    return "Structured policy";
  }

  return String(parsed).slice(0, 100);
}

async function getSelectedHotelSettingsSnapshot(req, res) {
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

  const matched = /^HT-([0-9]{4,})$/.exec(
    String(req.params?.hotelDisplayId || "")
  );

  const hotelId = matched ? Number(matched[1]) : NaN;

  if (!Number.isSafeInteger(hotelId) || hotelId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid hotel identifier.",
    });
  }

  try {
    const [hotels] = await db.query(
      `SELECT hotel_id, hotel_name, status
       FROM hotels
       WHERE hotel_id = ?
         AND superadmin_id = ?
       LIMIT 1`,
      [hotelId, ownerId]
    );

    if (hotels.length !== 1) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found in your portfolio.",
      });
    }

    // No getHotelSettings() call, ensureDefaults(),
    // INSERT, UPDATE, transaction or policy mutation.

    const [settings] = await db.query(
      `SELECT
         s.setting_section AS section,
         s.setting_key AS settingKey,
         s.setting_value AS settingValue,
         s.data_type AS dataType,
         s.version_no AS versionNo,
         s.updated_at AS updatedAt
       FROM hotel_settings s
       INNER JOIN hotels h
         ON h.hotel_id = s.hotel_id
       WHERE s.hotel_id = ?
         AND h.superadmin_id = ?
       ORDER BY s.setting_section, s.setting_key`,
      [hotelId, ownerId]
    );

    const [auditRows] = await db.query(
      `SELECT
         a.audit_id AS id,
         a.setting_section AS section,
         a.setting_key AS settingKey,
         a.action_type AS actionType,
         a.actor_type AS actorType,
         a.changed_at AS changedAt
       FROM hotel_setting_audit_logs a
       INNER JOIN hotels h
         ON h.hotel_id = a.hotel_id
       WHERE a.hotel_id = ?
         AND h.superadmin_id = ?
       ORDER BY a.changed_at DESC, a.audit_id DESC
       LIMIT 8`,
      [hotelId, ownerId]
    );

    const sections = new Map();

    for (const row of settings) {
      const section = String(row.section || "general");

      if (!sections.has(section)) {
        sections.set(section, []);
      }

      sections.get(section).push({
        key: row.settingKey,
        valuePreview: previewValue(row),
        versionNo: Number(row.versionNo) || 0,
        updatedAt: row.updatedAt,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        hotel: {
          displayId:
            `HT-${String(hotelId).padStart(4, "0")}`,
          name: hotels[0].hotel_name,
          status: hotels[0].status,
        },
        settingsCount: settings.length,
        sections: Array.from(
          sections,
          ([name, items]) => ({
            name,
            count: items.length,
            items,
          })
        ),
        recentChanges: auditRows,
        readOnly: true,
      },
    });
  } catch (error) {
    console.error(
      "[SUPER_ADMIN_SETTINGS_SNAPSHOT]",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Settings snapshot unavailable.",
    });
  }
}

module.exports = {
  getSelectedHotelSettingsSnapshot,
};