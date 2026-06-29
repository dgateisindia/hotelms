import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHotel } from "../../services/authService";

const HOTEL_TYPES = [
  "Resort",
  "Business Hotel",
  "Budget Hotel",
  "Boutique Hotel",
  "Homestay",
  "Lodge",
];

const CreateHotelPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    hotel_name: "",
    hotel_type: "",
    hotel_desc: "",
    star_rating: "",
    year_established: "",
    gst_number: "",
    pan_number: "",
    business_reg_number: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hotelId, setHotelId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setHotelId(null);

    if (!form.hotel_name.trim()) {
      setError("Hotel name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await createHotel(form);
      setSuccess(res.data.message || "Hotel created successfully.");
      setHotelId(res.data.hotel_id);
      setForm({
        hotel_name: "",
        hotel_type: "",
        hotel_desc: "",
        star_rating: "",
        year_established: "",
        gst_number: "",
        pan_number: "",
        business_reg_number: "",
      });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to create hotel. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.heading}>Create Hotel</h2>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        {hotelId && (
          <div style={styles.resultBox}>
            <strong>Hotel ID:</strong>
            <div style={styles.resultId}>{hotelId}</div>
            <p style={styles.resultNote}>
              Use this ID to create an admin account for this hotel.
            </p>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate("/register-admin", { state: { hotel_id: hotelId } })}
            >
              Create Admin for this Hotel →
            </button>
          </div>
        )}

        <label style={styles.label}>Hotel Name</label>
        <input
          type="text"
          name="hotel_name"
          placeholder="e.g. Grand Palace Hotel"
          value={form.hotel_name}
          onChange={handleChange}
          style={styles.input}
          required
        />

        <label style={styles.label}>Hotel Type</label>
        <select
          name="hotel_type"
          value={form.hotel_type}
          onChange={handleChange}
          style={styles.input}
        >
          <option value="">Select hotel type</option>
          {HOTEL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label style={styles.label}>Description</label>
        <textarea
          name="hotel_desc"
          placeholder="Describe the hotel — location, facilities, features..."
          value={form.hotel_desc}
          onChange={handleChange}
          style={{ ...styles.input, height: "80px", resize: "vertical" }}
        />

        <label style={styles.label}>Star Rating</label>
        <select
          name="star_rating"
          value={form.star_rating}
          onChange={handleChange}
          style={styles.input}
        >
          <option value="">Select rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>
          ))}
        </select>

        <label style={styles.label}>Year Established</label>
        <input
          type="text"
          name="year_established"
          placeholder="e.g. 2005"
          value={form.year_established}
          onChange={handleChange}
          style={styles.input}
          maxLength={4}
        />

        <label style={styles.label}>GST Number</label>
        <input
          type="text"
          name="gst_number"
          placeholder="e.g. 22ABCDE1234F1Z5"
          value={form.gst_number}
          onChange={handleChange}
          style={styles.input}
        />

        <label style={styles.label}>PAN Number</label>
        <input
          type="text"
          name="pan_number"
          placeholder="e.g. ABCDE1234F"
          value={form.pan_number}
          onChange={handleChange}
          style={styles.input}
          maxLength={10}
        />

        <label style={styles.label}>Business Registration No.</label>
        <input
          type="text"
          name="business_reg_number"
          placeholder="e.g. U55101MH2005PTC153147"
          value={form.business_reg_number}
          onChange={handleChange}
          style={styles.input}
        />

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Creating..." : "Create Hotel"}
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
    padding: "24px 0",
  },
  form: {
    backgroundColor: "#fff",
    padding: "32px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    width: "420px",
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
  resultBox: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  resultId: {
    fontFamily: "monospace",
    fontSize: "18px",
    fontWeight: "bold",
    margin: "6px 0",
    color: "#166534",
  },
  resultNote: {
    fontSize: "12px",
    color: "#4a5568",
    margin: "0 0 10px 0",
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
  },
};

export default CreateHotelPage;