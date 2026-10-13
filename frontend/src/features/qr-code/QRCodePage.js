import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useOutletContext,
} from "react-router-dom";

import {
  QRCodeCanvas,
} from "qrcode.react";

import apiClient, {
  getApiErrorMessage,
} from "../../shared/api/apiClient";

import "./QRCodePage.css";


function safeFilePart(
  value
) {
  return String(
    value || "hotel"
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) || "hotel";
}


function escapeHtml(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


const QRCodePage = () => {
  const {
    selectedHotel,
  } =
    useOutletContext() || {};

  const qrContainerRef =
    useRef(null);

  const [
    requestUrl,
    setRequestUrl,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  const [
    actionError,
    setActionError,
  ] = useState("");


  const hotelName =
    String(
      selectedHotel?.name ||
      selectedHotel?.hotelName ||
      "Assigned Hotel"
    ).trim();

  const hotelDisplayId =
    String(
      selectedHotel?.displayId ||
      selectedHotel?.hotelDisplayId ||
      ""
    )
      .trim()
      .toUpperCase();


  useEffect(() => {
    let cancelled =
      false;

    const loadQr =
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await apiClient.get(
              "/customer-requests/qr-token"
            );

          const publicToken =
            response.data?.data
              ?.publicToken;

          if (!publicToken) {
            throw new Error(
              "QR token is unavailable."
            );
          }

          const baseUrl =
            (
              process.env
                .REACT_APP_PUBLIC_APP_URL ||
              window.location.origin
            ).replace(
              /\/+$/,
              ""
            );

          const url =
            `${baseUrl}/customer-request/${encodeURIComponent(
              publicToken
            )}`;

          if (!cancelled) {
            setRequestUrl(
              url
            );
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              getApiErrorMessage(
                loadError,
                "Unable to load this hotel's QR code."
              )
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false
            );
          }
        }
      };

    void loadQr();

    return () => {
      cancelled =
        true;
    };
  }, []);


  function getQrCanvas() {
    return (
      qrContainerRef.current
        ?.querySelector(
          "canvas"
        ) ||
      null
    );
  }


  async function handleCopyLink() {
    setActionMessage("");
    setActionError("");

    if (!requestUrl) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          requestUrl
        );

      setActionMessage(
        "Guest request link copied."
      );
    } catch (copyError) {
      console.error(
        "[QR:COPY]",
        copyError
      );

      setActionError(
        "Unable to copy the link. You can copy it manually below."
      );
    }
  }


  function handleDownload() {
    setActionMessage("");
    setActionError("");

    const canvas =
      getQrCanvas();

    if (!canvas) {
      setActionError(
        "QR image is not ready yet."
      );

      return;
    }

    try {
      const downloadLink =
        document.createElement(
          "a"
        );

      downloadLink.href =
        canvas.toDataURL(
          "image/png"
        );

      downloadLink.download =
        `${safeFilePart(
          hotelName
        )}-guest-request-qr.png`;

      document.body.appendChild(
        downloadLink
      );

      downloadLink.click();

      downloadLink.remove();

      setActionMessage(
        "QR code downloaded as PNG."
      );
    } catch (downloadError) {
      console.error(
        "[QR:DOWNLOAD]",
        downloadError
      );

      setActionError(
        "Unable to download the QR code."
      );
    }
  }


  function handlePrint() {
    setActionMessage("");
    setActionError("");

    const canvas =
      getQrCanvas();

    if (!canvas) {
      setActionError(
        "QR image is not ready yet."
      );

      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=760,height=900"
      );

    if (!printWindow) {
      setActionError(
        "Print window was blocked by the browser."
      );

      return;
    }

    const qrImage =
      canvas.toDataURL(
        "image/png"
      );

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(
            hotelName
          )} Guest Request QR</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 48px;
              font-family: Arial, sans-serif;
              color: #172033;
              background: #ffffff;
            }

            .sheet {
              max-width: 640px;
              margin: 0 auto;
              text-align: center;
              border: 1px solid #dce3ec;
              border-radius: 18px;
              padding: 44px;
            }

            h1 {
              margin: 0 0 8px;
              font-size: 26px;
            }

            .hotel-id {
              margin-bottom: 28px;
              color: #68758a;
              font-size: 14px;
            }

            img {
              width: 320px;
              height: 320px;
            }

            h2 {
              margin: 28px 0 8px;
              font-size: 20px;
            }

            p {
              color: #68758a;
              line-height: 1.55;
            }

            .url {
              margin-top: 24px;
              font-size: 11px;
              word-break: break-all;
            }

            @media print {
              body {
                padding: 0;
              }

              .sheet {
                border: 0;
              }
            }
          </style>
        </head>

        <body>
          <div class="sheet">
            <h1>
              ${escapeHtml(
                hotelName
              )}
            </h1>

            <div class="hotel-id">
              ${escapeHtml(
                hotelDisplayId
              )}
            </div>

            <img
              src="${qrImage}"
              alt="Guest request QR code"
            />

            <h2>
              Scan to Request a Room
            </h2>

            <p>
              Guests can scan this QR code to send a room request directly to the hotel.
            </p>

            <div class="url">
              ${escapeHtml(
                requestUrl
              )}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    window.setTimeout(
      () => {
        printWindow.print();
      },
      250
    );
  }


  if (loading) {
    return (
      <section className="hotel-qr-page">
        <div className="hotel-qr-state">
          <div
            className="hotel-qr-spinner"
            aria-hidden="true"
          />

          <h2>
            Loading Guest Request QR
          </h2>

          <p>
            Preparing the secure QR code for your assigned hotel.
          </p>
        </div>
      </section>
    );
  }


  if (error) {
    return (
      <section className="hotel-qr-page">
        <div className="hotel-qr-state hotel-qr-state--error">
          <h2>
            QR Code Unavailable
          </h2>

          <p>
            {error}
          </p>
        </div>
      </section>
    );
  }


  return (
    <section className="hotel-qr-page">

      <header className="hotel-qr-header">

        <div>
          <span className="hotel-qr-eyebrow">
            Guest Self-Service
          </span>

          <h1>
            Customer Room Request QR Code
          </h1>

          <p>
            Download, print or share this hotel-specific QR code with guests.
          </p>
        </div>

      </header>


      {(actionMessage ||
        actionError) && (
        <div
          className={
            actionError
              ? "hotel-qr-notice hotel-qr-notice--error"
              : "hotel-qr-notice hotel-qr-notice--success"
          }
        >
          {actionError ||
            actionMessage}
        </div>
      )}


      <div className="hotel-qr-grid">

        <article className="hotel-qr-card hotel-qr-card--identity">

          <div className="hotel-qr-section-title">
            Hotel Identity
          </div>

          <div className="hotel-qr-hotel">

            <div className="hotel-qr-hotel-icon">
              H
            </div>

            <div>
              <strong>
                {hotelName}
              </strong>

              {hotelDisplayId && (
                <span>
                  {hotelDisplayId}
                </span>
              )}
            </div>

          </div>

          <p className="hotel-qr-helper">
            This QR code belongs only to this assigned hotel. Guest requests are routed into this hotel's Customer Requests workflow.
          </p>

        </article>


        <article className="hotel-qr-card hotel-qr-card--qr">

          <div className="hotel-qr-section-title">
            Guest QR Code
          </div>

          <div
            ref={
              qrContainerRef
            }
            className="hotel-qr-code"
          >
            <QRCodeCanvas
              value={
                requestUrl
              }
              size={280}
              level="H"
              includeMargin
            />
          </div>

          <p className="hotel-qr-scan-copy">
            Scan to submit a room request
          </p>

        </article>


        <article className="hotel-qr-card hotel-qr-card--share">

          <div className="hotel-qr-section-title">
            Share & Display
          </div>

          <p className="hotel-qr-helper">
            Use this link or QR image at reception, guest communication points or approved hotel displays.
          </p>

          <label className="hotel-qr-link-label">
            Public Guest Link
          </label>

          <div className="hotel-qr-link-row">

            <input
              type="text"
              value={
                requestUrl
              }
              readOnly
              aria-label="Public guest request link"
            />

            <button
              type="button"
              className="hotel-qr-button hotel-qr-button--secondary"
              onClick={() =>
                void handleCopyLink()
              }
            >
              Copy Link
            </button>

          </div>


          <div className="hotel-qr-actions">

            <button
              type="button"
              className="hotel-qr-button hotel-qr-button--primary"
              onClick={
                handleDownload
              }
            >
              Download PNG
            </button>

            <button
              type="button"
              className="hotel-qr-button hotel-qr-button--secondary"
              onClick={
                handlePrint
              }
            >
              Print QR
            </button>

          </div>

        </article>

      </div>

    </section>
  );
};


export default QRCodePage;