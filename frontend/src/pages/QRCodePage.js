import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import apiClient, { getApiErrorMessage } from "../shared/api/apiClient";

const QRCodePage = () => {
  const [requestUrl, setRequestUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadQr = async () => {
      try {
        const res = await apiClient.get("/customer-requests/qr-token");
        const publicToken = res.data?.data?.publicToken;

        if (!publicToken) throw new Error("QR token is unavailable.");

        const baseUrl = (process.env.REACT_APP_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, "");
        const url = `${baseUrl}/customer-request/${encodeURIComponent(publicToken)}`;

        if (!cancelled) {
          setRequestUrl(url);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, "Unable to load this hotel's QR code."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadQr();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 50 }}>Loading QR code...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        <h2>Customer Room Request QR Code</h2>
        <p style={{ color: "#b91c1c" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h2>Customer Room Request QR Code</h2>

      <QRCodeCanvas value={requestUrl} size={250} />

      <p style={{ marginTop: 20 }}>Scan this QR code to request a room.</p>

      <p style={{ fontSize: 12, wordBreak: "break-all", maxWidth: 600, margin: "12px auto" }}>
        {requestUrl}
      </p>
    </div>
  );
};

export default QRCodePage;