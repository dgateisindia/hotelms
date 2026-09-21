import React from "react";

const COMMON_ROOM_TYPES = [
  "Deluxe Room",
  "Premium Room",
  "Suite Room",
  "Executive Room",
  "Presidential Suite",
];

function RoomFormModal({
  title,
  submitLabel,
  form,
  onChange,
  onSave,
  onClose,
  isSaving,
  error,
  statusOptions = [],
}) {
  const handleOverlayMouseDown = (event) => {
    if (
      event.target === event.currentTarget &&
      !isSaving
    ) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <h3>{title}</h3>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close room form"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave}>
          <div className="modal-body">
            {error && (
              <div
                className="room-form-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="modal-grid">
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-number"
                >
                  Room No.
                </label>

                <input
                  id="room-number"
                  className="form-input"
                  name="roomNo"
                  value={form.roomNo}
                  onChange={onChange}
                  placeholder="e.g. 101"
                  maxLength={20}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-floor"
                >
                  Floor
                </label>

                <input
                  id="room-floor"
                  className="form-input"
                  type="number"
                  name="floor"
                  min="0"
                  step="1"
                  value={form.floor}
                  onChange={onChange}
                  placeholder="e.g. 1"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-type"
                >
                  Room Type
                </label>

                <input
                  id="room-type"
                  className="form-input"
                  name="type"
                  list="room-type-options"
                  value={form.type}
                  onChange={onChange}
                  placeholder="e.g. Deluxe Room"
                  maxLength={100}
                  disabled={isSaving}
                  required
                />

                <datalist id="room-type-options">
                  {COMMON_ROOM_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      />
                    )
                  )}
                </datalist>
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-capacity"
                >
                  Capacity
                </label>

                <input
                  id="room-capacity"
                  className="form-input"
                  type="number"
                  name="capacity"
                  min="1"
                  step="1"
                  value={form.capacity}
                  onChange={onChange}
                  placeholder="e.g. 2"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-price"
                >
                  Price / Night
                </label>

                <input
                  id="room-price"
                  className="form-input"
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={onChange}
                  placeholder="e.g. 4000"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-status"
                >
                  Status
                </label>

                <select
                  id="room-status"
                  className="form-select"
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  disabled={isSaving}
                  required
                >
                  {statusOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-save"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RoomFormModal;