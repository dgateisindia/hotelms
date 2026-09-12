import apiClient from "../shared/api/apiClient";


/* ============================================================
   HOTEL SETTINGS SERVICE

   Supports both:

   HOTEL ADMIN
   ------------------------------------------------------------
   /api/hotel-settings

   Admin never sends a hotel ID.
   Backend resolves hotel from authenticated Admin context.


   SUPER ADMIN
   ------------------------------------------------------------
   /api/hotel-settings/hotel/:hotelId

   Frontend selected hotel uses:
   HT-0001

   Backend Settings API currently uses internal numeric ID:
   1

   Ownership is still verified by backend.
============================================================ */


/* ============================================================
   SCOPE
============================================================ */

export const HOTEL_SETTINGS_SCOPE = {
  ADMIN:
    "admin",

  SUPER_ADMIN:
    "super_admin",
};


/* ============================================================
   HOTEL DISPLAY ID
============================================================ */

const HOTEL_DISPLAY_ID_PATTERN =
  /^HT-(\d+)$/i;


function hotelIdFromDisplayId(
  hotelDisplayId
) {
  const normalized =
    String(
      hotelDisplayId || ""
    )
      .trim()
      .toUpperCase();


  const match =
    HOTEL_DISPLAY_ID_PATTERN
      .exec(
        normalized
      );


  if (!match) {
    throw new Error(
      "The selected hotel ID is invalid. Expected a value such as HT-0001."
    );
  }


  const hotelId =
    Number(
      match[1]
    );


  if (
    !Number.isSafeInteger(
      hotelId
    ) ||
    hotelId <= 0
  ) {
    throw new Error(
      "The selected hotel ID is invalid."
    );
  }


  return hotelId;
}


/* ============================================================
   RESPONSE
============================================================ */

function getPayload(
  response,
  fallbackMessage
) {
  const body =
    response?.data;


  if (
    !body ||
    body.success !== true
  ) {
    throw new Error(
      body?.message ||
      fallbackMessage
    );
  }


  return (
    body.data ??
    null
  );
}


/* ============================================================
   BASE PATH

   Admin:
   /hotel-settings

   Super Admin:
   /hotel-settings/hotel/1
============================================================ */

function getSettingsBasePath({
  scope,
  hotelDisplayId,
}) {
  if (
    scope ===
    HOTEL_SETTINGS_SCOPE.ADMIN
  ) {
    return "/hotel-settings";
  }


  if (
    scope ===
    HOTEL_SETTINGS_SCOPE.SUPER_ADMIN
  ) {
    const hotelId =
      hotelIdFromDisplayId(
        hotelDisplayId
      );


    return `/hotel-settings/hotel/${hotelId}`;
  }


  throw new Error(
    "A valid Hotel Settings scope is required."
  );
}


/* ============================================================
   CHANGE REASON
============================================================ */

function cleanReason(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const reason =
    String(value)
      .trim();


  return (
    reason ||
    null
  );
}


/* ============================================================
   SETTINGS CHANGES
============================================================ */

function normalizeChanges(
  changes
) {
  if (
    !Array.isArray(
      changes
    ) ||
    changes.length ===
      0
  ) {
    throw new Error(
      "At least one hotel setting change is required."
    );
  }


  return changes.map(
    (
      change,
      index
    ) => {
      const section =
        String(
          change?.section ||
          ""
        ).trim();


      const key =
        String(
          change?.key ||
          ""
        ).trim();


      if (
        !section ||
        !key ||
        !Object.prototype
          .hasOwnProperty
          .call(
            change || {},
            "value"
          )
      ) {
        throw new Error(
          `Hotel setting change ${index + 1} is incomplete.`
        );
      }


      return {
        section,
        key,

        value:
          change.value,

        ...(cleanReason(
          change?.changeReason
        )
          ? {
              changeReason:
                cleanReason(
                  change
                    .changeReason
                ),
            }
          : {}),
      };
    }
  );
}


/* ============================================================
   AUDIT FILTERS
============================================================ */

function buildAuditParams(
  filters = {}
) {
  const params = {};


  const section =
    String(
      filters.section ||
      ""
    ).trim();


  const actorType =
    String(
      filters.actorType ||
      ""
    ).trim();


  const actorId =
    String(
      filters.actorId ??
      ""
    ).trim();


  const fromDate =
    String(
      filters.fromDate ||
      ""
    ).trim();


  const toDate =
    String(
      filters.toDate ||
      ""
    ).trim();


  if (section) {
    params.section =
      section;
  }


  if (actorType) {
    params.actorType =
      actorType;
  }


  if (actorId) {
    params.actorId =
      actorId;
  }


  if (fromDate) {
    params.fromDate =
      fromDate;
  }


  if (toDate) {
    params.toDate =
      toDate;
  }


  const page =
    Number.parseInt(
      filters.page,
      10
    );


  const pageSize =
    Number.parseInt(
      filters.pageSize,
      10
    );


  params.page =
    Number.isSafeInteger(
      page
    ) &&
    page > 0
      ? page
      : 1;


  params.pageSize =
    Number.isSafeInteger(
      pageSize
    ) &&
    pageSize > 0
      ? Math.min(
          pageSize,
          100
        )
      : 50;


  return params;
}


/* ============================================================
   GET SETTINGS
============================================================ */

async function getSettings({
  scope,
  hotelDisplayId =
    null,
}) {
  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const response =
    await apiClient.get(
      basePath
    );


  return getPayload(
    response,
    "Hotel settings could not be loaded."
  );
}


/* ============================================================
   GET POLICY CAPABILITIES

   Frontend will use these values for:
   - charge-method dropdowns
   - room pricing dropdowns
   - VIP billing
   - refund handling

   Do not duplicate these policy capabilities in UI code.
============================================================ */

async function getCapabilities({
  scope,
  hotelDisplayId =
    null,
}) {
  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const response =
    await apiClient.get(
      `${basePath}/capabilities`
    );


  return getPayload(
    response,
    "Hotel policy options could not be loaded."
  );
}


/* ============================================================
   UPDATE SETTINGS

   Multiple fields may be saved together.

   Backend handles:
   - transaction
   - audit
   - setting version
   - policy version
============================================================ */

async function updateSettings({
  scope,
  hotelDisplayId =
    null,

  changes,

  changeReason =
    null,
}) {
  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const payload = {
    changes:
      normalizeChanges(
        changes
      ),
  };


  const normalizedReason =
    cleanReason(
      changeReason
    );


  if (normalizedReason) {
    payload.changeReason =
      normalizedReason;
  }


  const response =
    await apiClient.patch(
      basePath,
      payload
    );


  return getPayload(
    response,
    "Hotel settings could not be updated."
  );
}


/* ============================================================
   GET AUDIT HISTORY
============================================================ */

async function getAuditHistory({
  scope,
  hotelDisplayId =
    null,

  filters =
    {},
}) {
  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const response =
    await apiClient.get(
      `${basePath}/audit`,
      {
        params:
          buildAuditParams(
            filters
          ),
      }
    );


  return getPayload(
    response,
    "Settings activity history could not be loaded."
  );
}


/* ============================================================
   RESTORE PREVIOUS SETTING

   Existing audit history is NOT deleted.

   Backend creates:
   - new setting version
   - new restore audit record
   - new policy version when applicable
============================================================ */

async function restoreSetting({
  scope,
  hotelDisplayId =
    null,

  auditId,

  changeReason =
    null,
}) {
  const id =
    Number(
      auditId
    );


  if (
    !Number.isSafeInteger(
      id
    ) ||
    id <= 0
  ) {
    throw new Error(
      "A valid settings history record is required."
    );
  }


  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const payload = {
    auditId:
      id,
  };


  const normalizedReason =
    cleanReason(
      changeReason
    );


  if (normalizedReason) {
    payload.changeReason =
      normalizedReason;
  }


  const response =
    await apiClient.post(
      `${basePath}/restore`,
      payload
    );


  return getPayload(
    response,
    "The previous hotel setting could not be restored."
  );
}


/* ============================================================
   RESET ONE SETTING TO HMS DEFAULT
============================================================ */

async function resetSetting({
  scope,
  hotelDisplayId =
    null,

  section,
  key,

  changeReason =
    null,
}) {
  const normalizedSection =
    String(
      section ||
      ""
    ).trim();


  const normalizedKey =
    String(
      key ||
      ""
    ).trim();


  if (
    !normalizedSection ||
    !normalizedKey
  ) {
    throw new Error(
      "A valid hotel setting is required."
    );
  }


  const basePath =
    getSettingsBasePath({
      scope,
      hotelDisplayId,
    });


  const payload = {
    section:
      normalizedSection,

    key:
      normalizedKey,
  };


  const normalizedReason =
    cleanReason(
      changeReason
    );


  if (normalizedReason) {
    payload.changeReason =
      normalizedReason;
  }


  const response =
    await apiClient.post(
      `${basePath}/reset`,
      payload
    );


  return getPayload(
    response,
    "The hotel setting could not be reset."
  );
}


/* ============================================================
   EXPORT
============================================================ */

const hotelSettingsService = {
  getSettings,
  getCapabilities,
  updateSettings,
  getAuditHistory,
  restoreSetting,
  resetSetting,
};


export default hotelSettingsService;