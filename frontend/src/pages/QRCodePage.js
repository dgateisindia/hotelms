import React from "react";
import { QRCodeCanvas } from "qrcode.react";

const QRCodePage = () => {
  const url = "http://192.168.1.21:3000/customer-request"; // Change after deployment

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Customer Room Request QR Code</h2>

      <QRCodeCanvas value={url} size={250} />

      <p style={{ marginTop: "20px" }}>
        Scan this QR code to request a room.
      </p>
    </div>
  );
};

export default QRCodePage;