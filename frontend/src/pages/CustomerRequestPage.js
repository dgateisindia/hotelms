// src/pages/CustomerRequestPage.js

import React, { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

// The customer's phone is on a different device than the admin dashboard,
// so this page can't rely on a relative path / CRA proxy like the rest of
// the app does — it needs the backend's reachable address explicitly.
// Keep this in one place so it's easy to update when you deploy.
const API_BASE_URL = "http://192.168.1.21:5000/api/customer-requests";

const CustomerRequestPage = () => {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    nationality: "",
    address: "",
    check_in: "",
    check_out: "",
    guests: 1,
    room_type: "",
    special_request: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validate = () => {
    if (
      !form.full_name ||
      !form.phone ||
      !form.gender ||
      !form.nationality ||
      !form.check_in ||
      !form.check_out
    ) {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Form",
        text: "Please fill all required fields.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      await axios.post(API_BASE_URL, form);

      // Show the thank-you screen instead of the form. No need for the
      // success alert anymore since the page itself now confirms it.
      setSubmitted(true);

      setForm({
        full_name: "",
        email: "",
        phone: "",
        gender: "",
        nationality: "",
        address: "",
        check_in: "",
        check_out: "",
        guests: 1,
        room_type: "",
        special_request: "",
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text:
          err.response?.data?.message ||
          "Unable to submit your request.",
      });
    }

    setLoading(false);
  };

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f4f7fb",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 30,
        }}
      >
        <div
          style={{
            width: 650,
            background: "#fff",
            borderRadius: 15,
            padding: 45,
            boxShadow: "0 10px 25px rgba(0,0,0,.12)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
          <h2
            style={{
              marginBottom: 10,
              color: "#1e3a8a",
            }}
          >
            Thank You!
          </h2>
          <p
            style={{
              color: "#555",
              fontSize: 16,
              lineHeight: 1.5,
            }}
          >
            Your room request has been received. We'll update you soon via
            email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 30,
      }}
    >
      <div
        style={{
          width: 650,
          background: "#fff",
          borderRadius: 15,
          padding: 35,
          boxShadow: "0 10px 25px rgba(0,0,0,.12)",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: 10,
            color: "#1e3a8a",
          }}
        >
          Hotel Room Request
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: 30,
          }}
        >
          Fill in your details and we'll confirm your room shortly.
        </p>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="full_name"
            placeholder="Full Name *"
            value={form.full_name}
            onChange={handleChange}
            style={styles.input}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone Number *"
            value={form.phone}
            onChange={handleChange}
            style={styles.input}
          />

          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Gender *</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          <input
            type="text"
            name="nationality"
            placeholder="Nationality *"
            value={form.nationality}
            onChange={handleChange}
            style={styles.input}
          />

          <textarea
            name="address"
            placeholder="Address"
            value={form.address}
            onChange={handleChange}
            style={styles.textarea}
          />

          <label>Check-In</label>

          <input
            type="date"
            name="check_in"
            value={form.check_in}
            onChange={handleChange}
            style={styles.input}
          />

          <label>Check-Out</label>

          <input
            type="date"
            name="check_out"
            value={form.check_out}
            onChange={handleChange}
            style={styles.input}
          />

          <input
            type="number"
            name="guests"
            min="1"
            value={form.guests}
            onChange={handleChange}
            style={styles.input}
          />

          <select
            name="room_type"
            value={form.room_type}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Preferred Room Type (optional)</option>
            <option>Deluxe Room</option>
            <option>Premium Room</option>
            <option>Suite Room</option>
            <option>Executive Room</option>
            <option>Presidential Suite</option>
          </select>

          <textarea
            name="special_request"
            placeholder="Special Request"
            value={form.special_request}
            onChange={handleChange}
            style={styles.textarea}
          />

          <button
            type="submit"
            disabled={loading}
            style={styles.button}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>

        </form>
      </div>
    </div>
  );
};

const styles = {
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 15,
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    border: "1px solid #ccc",
    borderRadius: 8,
    minHeight: 80,
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },

  button: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
};

export default CustomerRequestPage;