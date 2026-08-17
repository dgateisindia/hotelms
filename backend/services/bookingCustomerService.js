const {
  getPhoneCandidates,
} = require("./bookingValidation");


/* ============================================================
   SERVICE ERROR
============================================================ */

function throwHttp(
  status,
  code,
  message
) {
  const error =
    new Error(message);

  error.status =
    status;

  error.code =
    code;

  throw error;
}


/* ============================================================
   PROFILE VALUE COMPARISON
============================================================ */

function sameText(
  first,
  second
) {
  return String(
    first || ""
  )
    .trim()
    .toLowerCase() ===
    String(
      second || ""
    )
      .trim()
      .toLowerCase();
}


/* ============================================================
   FIND OR CREATE BOOKING CUSTOMER

   Rules:
   - Hotel scoped
   - Canonical + legacy phone matching
   - Existing profile is never silently overwritten
   - Duplicate ID proof blocked
   - New customer created inside booking transaction
============================================================ */

async function findOrCreateCustomer(
  connection,
  hotelId,
  customer
) {
  const phoneCandidates =
    getPhoneCandidates(
      customer.phone
    );


  const [rows] =
    await connection.query(
      `
        SELECT
          customer_id,
          full_name,
          email,
          phone,
          gender,
          nationality,
          address,
          id_proof_type,
          id_proof_number

        FROM customers

        WHERE hotel_id = ?

          AND phone IN (
            ?,
            ?
          )

        ORDER BY
          CASE
            WHEN phone = ?
            THEN 0
            ELSE 1
          END,

          customer_id ASC

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        phoneCandidates[0],
        phoneCandidates[1],
        phoneCandidates[0],
      ]
    );


  if (
    rows.length
  ) {
    const existing =
      rows[0];

    const mismatches =
      [];


    if (
      !sameText(
        existing.full_name,
        customer.fullName
      )
    ) {
      mismatches.push(
        "name"
      );
    }


    if (
      customer.email &&
      !sameText(
        existing.email,
        customer.email
      )
    ) {
      mismatches.push(
        "email"
      );
    }


    if (
      customer.gender &&
      !sameText(
        existing.gender,
        customer.gender
      )
    ) {
      mismatches.push(
        "gender"
      );
    }


    if (
      customer.nationality &&
      !sameText(
        existing.nationality,
        customer.nationality
      )
    ) {
      mismatches.push(
        "nationality"
      );
    }


    if (
      customer.address &&
      !sameText(
        existing.address,
        customer.address
      )
    ) {
      mismatches.push(
        "address"
      );
    }


    if (
      customer.idProofType &&
      !sameText(
        existing.id_proof_type,
        customer.idProofType
      )
    ) {
      mismatches.push(
        "ID proof type"
      );
    }


    if (
      customer.idProofNumber &&
      !sameText(
        existing.id_proof_number,
        customer.idProofNumber
      )
    ) {
      mismatches.push(
        "ID proof number"
      );
    }


    if (
      mismatches.length
    ) {
      throwHttp(
        409,
        "CUSTOMER_PROFILE_MISMATCH",
        `An existing customer was found with this phone number. Update the customer's ${mismatches.join(
          ", "
        )} before creating this booking.`
      );
    }


    return {
      customerId:
        Number(
          existing.customer_id
        ),

      existing: true,
    };
  }


  /*
   * Prevent duplicate ID proof inside the same hotel.
   */
  if (
    customer.idProofNumber
  ) {
    const [[idMatch]] =
      await connection.query(
        `
          SELECT
            customer_id

          FROM customers

          WHERE hotel_id = ?
            AND id_proof_number = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          hotelId,
          customer.idProofNumber,
        ]
      );


    if (
      idMatch
    ) {
      throwHttp(
        409,
        "CUSTOMER_ID_PROOF_EXISTS",
        "Another customer already uses this ID proof number in this hotel."
      );
    }
  }


  const [result] =
    await connection.query(
      `
        INSERT INTO customers (
          hotel_id,
          full_name,
          email,
          phone,
          gender,
          nationality,
          address,
          id_proof_type,
          id_proof_number
        )

        VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `,
      [
        hotelId,
        customer.fullName,
        customer.email,
        customer.phone,
        customer.gender,
        customer.nationality,
        customer.address,
        customer.idProofType,
        customer.idProofNumber,
      ]
    );


  return {
    customerId:
      Number(
        result.insertId
      ),

    existing: false,
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  findOrCreateCustomer,
};