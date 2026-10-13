import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useOutletContext } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import {
  fetchSelectedHotelQr,
  fetchSelectedHotelSettings,
} from "../../services/superAdminQrSettingsService";

import "./HotelQrSettings.css";

function label(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function SettingsOverview({ snapshot }) {
  if (!snapshot) return null;

  return (
    <section className="hotel-qr-settings__panel">
      <div className="hotel-qr-settings__panel-heading">
        <div>
          <h2>Saved Hotel Settings</h2>
          <p>
            Read-only values already stored for this hotel.
            No default initialization occurs.
          </p>
        </div>

        <span className="hotel-qr-settings__count">
          {snapshot.settingsCount} saved
        </span>
      </div>

      {snapshot.sections.length === 0 ? (
        <div className="hotel-qr-settings__empty">
          No saved settings found. Existing Hotel Admin
          Settings configuration remains unchanged.
        </div>
      ) : (
        <div className="hotel-qr-settings__sections">
          {snapshot.sections.map((section) => (
            <details
              key={section.name}
              className="hotel-qr-settings__section"
            >
              <summary>
                <strong>{label(section.name)}</strong>
                <span>{section.count} settings</span>
              </summary>

              <div className="hotel-qr-settings__settings-list">
                {section.items.map((item) => (
                  <div
                    className="hotel-qr-settings__setting-row"
                    key={item.key}
                  >
                    <div>
                      <strong>{label(item.key)}</strong>
                      <small>
                        Version {item.versionNo}
                      </small>
                    </div>

                    <span>{item.valuePreview}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function AuditOverview({ changes }) {
  return (
    <section className="hotel-qr-settings__panel">
      <div className="hotel-qr-settings__panel-heading">
        <div>
          <h2>Recent Settings Activity</h2>
          <p>Latest recorded changes for this hotel.</p>
        </div>
      </div>

      {!changes.length ? (
        <p className="hotel-qr-settings__empty">
          No settings activity recorded.
        </p>
      ) : (
        <div className="hotel-qr-settings__audit-list">
          {changes.map((change) => (
            <div
              className="hotel-qr-settings__audit-row"
              key={change.id}
            >
              <div>
                <strong>
                  {label(change.section)} · {label(change.settingKey)}
                </strong>

                <span>
                  {label(change.actionType)} by{" "}
                  {label(change.actorType)}
                </span>
              </div>

              <small>{displayDate(change.changedAt)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HotelQrSettings() {
  const {
    selectedHotel,
    workspaceRefreshKey = 0,
  } = useOutletContext();

  const hotelId = selectedHotel?.displayId;
  const requestId = useRef(0);

  const [qrData, setQrData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [qrError, setQrError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const id = ++requestId.current;

    setQrData(null);
    setSettingsData(null);
    setQrError("");
    setSettingsError("");
    setCopyStatus("");
    setLoading(true);

    if (!hotelId) {
      setLoading(false);
      return () => {
        requestId.current += 1;
      };
    }

    async function load() {
      const [qrResult, settingsResult] = await Promise.allSettled([
        fetchSelectedHotelQr(hotelId),
        fetchSelectedHotelSettings(hotelId),
      ]);

      if (id !== requestId.current) return;

      if (qrResult.status === "fulfilled") {
        setQrData(qrResult.value);
      } else {
        setQrError(
          qrResult.reason?.message || "QR information unavailable."
        );
      }

      if (settingsResult.status === "fulfilled") {
        setSettingsData(settingsResult.value);
      } else {
        setSettingsError(
          settingsResult.reason?.message ||
            "Saved settings unavailable."
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      requestId.current += 1;
    };
  }, [hotelId, workspaceRefreshKey]);

  const qr = qrData?.qr;

  const requestLink =
    qr?.enabled && typeof qr.publicToken === "string"
      ? `${
          process.env.REACT_APP_PUBLIC_APP_URL ||
          window.location.origin
        }`.replace(/\/+$/, "") +
        `/customer-request/${encodeURIComponent(qr.publicToken)}`
      : "";

  async function copyLink() {
    if (!requestLink) return;

    try {
      await navigator.clipboard.writeText(requestLink);
      setCopyStatus("Guest request link copied.");
    } catch {
      setCopyStatus("Copy unavailable in this browser.");
    }
  }

  return (
    <main className="hotel-qr-settings">
      <header className="hotel-qr-settings__header">
        <span className="hotel-qr-settings__eyebrow">
          SELECTED HOTEL / CONFIGURATION
        </span>

        <h1>QR & Settings</h1>

        <p>
          QR access and saved configuration for{" "}
          <strong>{selectedHotel?.name || hotelId}</strong>.
          This workspace is read-only.
        </p>
      </header>

      {loading ? (
        <div className="hotel-qr-settings__loading" role="status">
          Loading hotel QR and settings...
        </div>
      ) : (
        <>
          <section className="hotel-qr-settings__panel">
            <div className="hotel-qr-settings__panel-heading">
              <div>
                <h2>Customer Room Request QR</h2>
                <p>
                  Existing QR for this hotel. No token changes.
                </p>
              </div>

              <span
                className={
                  qr?.enabled
                    ? "hotel-qr-settings__status hotel-qr-settings__status--active"
                    : "hotel-qr-settings__status"
                }
              >
                {qr?.enabled ? "Active" : "Unavailable"}
              </span>
            </div>

            {qrError ? (
              <p className="hotel-qr-settings__error" role="alert">
                {qrError}
              </p>
            ) : requestLink ? (
              <div className="hotel-qr-settings__qr-content">
                <div className="hotel-qr-settings__qr-frame">
                  <QRCodeCanvas
                    value={requestLink}
                    size={210}
                  />
                </div>

                <div className="hotel-qr-settings__qr-details">
                  <h3>QR ready for guest room requests</h3>

                  <p>
                    Guests can scan this QR and submit a room
                    request using the existing public form.
                  </p>

                  <div className="hotel-qr-settings__meta">
                    <span>Hotel</span>
                    <strong>{hotelId}</strong>
                  </div>

                  <div className="hotel-qr-settings__meta">
                    <span>QR Status</span>
                    <strong>{label(qr.status)}</strong>
                  </div>

                  <div className="hotel-qr-settings__actions">
                    <button type="button" onClick={copyLink}>
                      Copy Guest Link
                    </button>

                    <a
                      href={requestLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Guest Form
                    </a>
                  </div>

                  {copyStatus && (
                    <p className="hotel-qr-settings__copy-status">
                      {copyStatus}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="hotel-qr-settings__empty">
                This hotel's QR is not available for guest
                requests. Configuration and status remain unchanged.
              </p>
            )}
          </section>

          {settingsError ? (
            <p className="hotel-qr-settings__error" role="alert">
              {settingsError}
            </p>
          ) : settingsData ? (
            <>
              <SettingsOverview snapshot={settingsData} />

              <AuditOverview
                changes={settingsData.recentChanges || []}
              />
            </>
          ) : null}

          <p className="hotel-qr-settings__footnote">
            To change policy settings, use the existing audited
            Hotel Settings workflow. This screen does not
            create or modify settings, QR tokens, requests,
            or bookings.
          </p>
        </>
      )}
    </main>
  );
}

export default HotelQrSettings;