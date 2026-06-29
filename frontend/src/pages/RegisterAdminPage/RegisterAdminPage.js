// frontend/src/pages/RegisterAdminPage/RegisterAdminPage.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerAdmin } from "../../services/authService";

const RegisterAdminPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    hotel_id: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setTempPassword("");

    if (!form.full_name || !form.email || !form.hotel_id) {
      setError("Full name, email, and hotel ID are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerAdmin(form);
      setSuccess(res.data.message || "Admin created successfully.");
      setTempPassword(res.data.temp_password || "");
      setForm({ full_name: "", email: "", phone: "", hotel_id: "" });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to create admin. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.heading}>Create Admin Account</h2>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        {tempPassword && (
          <div style={styles.tempBox}>
            <strong>Temporary Password:</strong>
            <div style={styles.tempPasswordText}>{tempPassword}</div>
            <p style={styles.tempNote}>
              Share this with the admin now — it won't be shown again. They'll be
              required to change it on first login.
            </p>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate("/login")}
            >
              Go to Login →
            </button>
          </div>
        )}

        <label style={styles.label}>Full Name</label>
        <input
          type="text"
          name="full_name"
          placeholder="Admin's full name"
          value={form.full_name}
          onChange={handleChange}
          style={styles.input}
          required
        />

        <label style={styles.label}>Email</label>
        <input
          type="email"
          name="email"
          placeholder="admin@hotelms.com"
          value={form.email}
          onChange={handleChange}
          style={styles.input}
          required
        />

        <label style={styles.label}>Phone</label>
        <input
          type="text"
          name="phone"
          placeholder="+91 00000 00000"
          value={form.phone}
          onChange={handleChange}
          style={styles.input}
        />

        <label style={styles.label}>Hotel ID</label>
        <input
          type="text"
          name="hotel_id"
          placeholder="e.g. 3"
          value={form.hotel_id}
          onChange={handleChange}
          style={styles.input}
          required
        />
        {/* swap for a <select> populated from a hotels-list endpoint once available */}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
  },
  form: {
    backgroundColor: "#fff",
    padding: "32px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    width: "380px",
  },
  heading: {
    marginBottom: "20px",
    textAlign: "center",
    color: "#1a202c",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    color: "#4a5568",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "16px",
    borderRadius: "4px",
    border: "1px solid #cbd5e0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#2b6cb0",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "15px",
    cursor: "pointer",
  },
  error: { color: "#e53e3e", fontSize: "13px", marginBottom: "12px" },
  success: { color: "#38a169", fontSize: "13px", marginBottom: "12px" },
  tempBox: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  tempPasswordText: {
    fontFamily: "monospace",
    fontSize: "16px",
    fontWeight: "bold",
    margin: "6px 0",
    color: "#166534",
  },
  tempNote: {
    fontSize: "12px",
    color: "#4a5568",
    margin: 0,
  },
  linkButton: {
    width: "100%",
    padding: "8px",
    backgroundColor: "#166534",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    marginTop: "8px",
  },
};

export default RegisterAdminPage;