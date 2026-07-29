import React from "react";

function CustomerFormModal({
  title,
  form,
  handleFormChange,
  handleImageChange,
  onSave,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>{title}</h2>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="modal-grid">

            {/* Full Name */}
            <div className="form-group full">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleFormChange}
                placeholder="Enter full name"
              />
            </div>

           {/* Email */}
<div className="form-group">
  <label className="form-label">Email</label>
  <input
    className="form-input"
    type="email"
    name="email"
    value={form.email || ''}
    onChange={handleFormChange}
    placeholder="Enter email"
  />  
</div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                   type="text"
                   name="phone"
                   value={form.phone}
                   onChange={handleFormChange}
                   disabled={title === "Edit Customer"}
              />
            </div>

            {/* Gender */}
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                name="gender"
                value={form.gender}
                onChange={handleFormChange}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Nationality */}
            <div className="form-group">
              <label className="form-label">Nationality</label>
              <input
                className="form-input"
                type="text"
                name="nationality"
                value={form.nationality}
                onChange={handleFormChange}
                placeholder="Enter nationality"
              />
            </div>

            {/* Address */}
            <div className="form-group full">
              <label className="form-label">Address</label>
              <textarea
                className="form-input"
                name="address"
                value={form.address}
                onChange={handleFormChange}
                rows="3"
                placeholder="Enter address"
              />
            </div>

            {/* ID Proof Type */}
            <div className="form-group">
              <label className="form-label">ID Proof Type</label>
              <select
                className="form-select"
                name="id_proof_type"
                value={form.id_proof_type}
                onChange={handleFormChange}
              >
                <option value="">Select ID Proof</option>
                <option value="Aadhaar">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>

            {/* ID Proof Number */}
            <div className="form-group">
              <label className="form-label">ID Proof Number</label>
              <input
                className="form-input"
                type="text"
                name="id_proof_number"
                value={form.id_proof_number}
                onChange={handleFormChange}
                placeholder="Enter ID Number"
              />
            </div>

            {/* Customer Type */}
            <div className="form-group">
              <label className="form-label">Customer Type</label>
              <select
                className="form-select"
                name="customer_type"
                value={form.customer_type}
                onChange={handleFormChange}
              >
                <option value="Normal">Normal</option>
                <option value="VIP">VIP</option>
              </select>
            </div>

            {/* Profile Image */}
            <div className="form-group full">
              <label className="form-label">Profile Image</label>

              <input
                className="form-input"
                type="file"
                name="profile_image"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleImageChange}
              />

              <small>
                Allowed: JPG, PNG, PDF (Max 100 KB)
              </small>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-save"
            onClick={onSave}
          >
            Save Customer
          </button>
        </div>

      </div>
    </div>
  );
}

export default CustomerFormModal;