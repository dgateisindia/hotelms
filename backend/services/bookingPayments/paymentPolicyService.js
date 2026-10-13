const {
  getBookingPolicySnapshotWithConnection,
} = require(
  "../hotelSettingsService"
);


/* ============================================================
   PAYMENT POLICY SERVICE

   Financial operational policy for an existing booking comes
   from its immutable booking policy snapshot.

   Current hotel settings must not silently rewrite the policy
   contract of an existing booking.

   Legacy bookings that have no snapshot preserve the previous
   HMS payment behaviour.
============================================================ */


const SUPPORTED_PAYMENT_METHODS =
  new Set([
    "cash",
    "card",
    "upi",
    "bank_transfer",
  ]);


function normalizePaymentMethodForPolicy(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}


function getLegacyPaymentPolicy() {

  return {
    source:
      "legacy_fallback",

    snapshotId:
      null,

    allowPartialPayment:
      true,

    fullPaymentRequiredBeforeCheckout:
      true,

    allowedMethods: [
      ...SUPPORTED_PAYMENT_METHODS,
    ],

    advanceRequirement: {
      method:
        "none",

      value:
        0,
    },
  };
}


async function resolveBookingPaymentPolicyWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {

  const snapshot =
    await getBookingPolicySnapshotWithConnection(
      connection,
      {
        hotelId,
        bookingId,
      }
    );


  if (!snapshot) {

    return getLegacyPaymentPolicy();
  }


  const policy =
    snapshot
      ?.policySnapshot
      ?.payment;


  if (
    !policy ||
    typeof policy !==
      "object"
  ) {

    return getLegacyPaymentPolicy();
  }


  const allowedMethods =
    Array.isArray(
      policy.allowed_methods
    )

      ? [
          ...new Set(
            policy
              .allowed_methods
              .map(
                normalizePaymentMethodForPolicy
              )
              .filter(
                (method) =>
                  SUPPORTED_PAYMENT_METHODS
                    .has(method)
              )
          ),
        ]

      : [
          ...SUPPORTED_PAYMENT_METHODS,
        ];


  return {
    source:
      "booking_snapshot",

    snapshotId:
      Number(
        snapshot.snapshotId
      ),

    allowPartialPayment:
      policy
        .allow_partial_payment !==
        false,

    fullPaymentRequiredBeforeCheckout:
      policy
        .full_payment_required_before_checkout !==
        false,

    allowedMethods,

    advanceRequirement:
      policy.advance_requirement &&
      typeof policy.advance_requirement ===
        "object"

        ? policy.advance_requirement

        : {
            method:
              "none",

            value:
              0,
          },
  };
}


module.exports = {
  SUPPORTED_PAYMENT_METHODS,
  normalizePaymentMethodForPolicy,
  resolveBookingPaymentPolicyWithConnection,
};