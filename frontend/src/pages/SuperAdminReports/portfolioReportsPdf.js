import jsPDF from "jspdf";

/* SUPER ADMIN-SA4D — structured, data-driven PDF export.
   Uses the same authenticated report object as the CSV and on-screen KPIs.
   No network requests, screenshots, or changes to financial calculations. */
const money = value => `INR ${new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
}).format(Number(value) || 0)}`;
const qty = value => new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
}).format(Number(value) || 0);
const rate = value => `${(Number(value) || 0).toFixed(1)}%`;
const text = value => String(value == null || value === "" ? "-" : value)
  .replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/[\u00a0\u202f]/g, " ")
  .replace(/\u20b9/g, "INR ")
  .replace(/[^\x20-\x7e]/g, " ");

export function downloadPortfolioReportsPdf(report) {
  if (!report || !report.stats || !report.rangeStart || !report.rangeEnd) {
    throw new Error("A completed report is required before exporting PDF.");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 38;
  const R = W - L;
  const contentW = R - L;
  const bottom = H - 48;
  let y = 0;

  const navy = [17, 36, 79];
  const blue = [44, 87, 164];
  const muted = [105, 121, 148];
  const line = [225, 233, 243];
  const pale = [245, 248, 252];
  const green = [9, 133, 90];

  const font = (size, bold = false, color = navy) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const divider = (yy = y) => {
    doc.setDrawColor(...line);
    doc.line(L, yy, R, yy);
  };

  const drawTop = () => {
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 96, "F");
    font(11, true, [255, 255, 255]);
    doc.text("HOTEL MANAGEMENT", L, 32);
    font(8, false, [201, 216, 247]);
    doc.text("SUPER ADMIN  /  PORTFOLIO INTELLIGENCE", L, 47);
    font(18, true, [255, 255, 255]);
    doc.text("Reports & Analytics", L, 76);
    y = 115;
  };

  const nextPage = () => {
    doc.addPage();
    drawTop();
  };

  const ensure = height => {
    if (y + height > bottom) nextPage();
  };

  const section = (heading, note = "", keepFollowing = 0) => {
    ensure((note ? 58 : 43) + keepFollowing);
    font(12, true);
    doc.text(text(heading), L, y + 12);
    if (note) {
      font(8, false, muted);
      doc.text(text(note), L, y + 27);
      y += 38;
    } else y += 25;
    divider();
    y += 12;
  };

  const writeLines = (value, x, startY, maxW, size = 8, bold = false, ink = navy, lineH = 11) => {
    font(size, bold, ink);
    const lines = doc.splitTextToSize(text(value), maxW);
    lines.forEach((str, i) => doc.text(str, x, startY + i * lineH));
    return lines.length;
  };

  const labelValue = (label, value) => {
    const labelLines = doc.splitTextToSize(text(label), contentW * .40);
    const valueLines = doc.splitTextToSize(text(value), contentW * .54);
    const h = Math.max(labelLines.length, valueLines.length) * 12 + 12;
    ensure(h);
    writeLines(label, L, y + 11, contentW * .40, 9, false, muted, 12);
    font(9, true);
    valueLines.forEach((str, i) => doc.text(str, R, y + 11 + i * 12, { align: "right" }));
    y += h;
    divider();
  };

  // Each table repeats its heading after a page break and grows rows dynamically.
  const table = (columns, rows, emptyText = "No records for this period") => {
    const widths = columns.map(col => col.width);
    const sum = widths.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - contentW) > 1) throw new Error("PDF table width mismatch.");

    const heading = () => {
      ensure(35);
      doc.setFillColor(...pale);
      doc.roundedRect(L, y, contentW, 28, 3, 3, "F");
      let x = L;
      columns.forEach((c, i) => {
        font(7, true, muted);
        doc.text(text(c.label), x + 5, y + 17);
        x += widths[i];
      });
      y += 34;
    };
    heading();

    if (!rows.length) {
      ensure(30);
      font(9, false, muted);
      doc.text(emptyText, L + 6, y + 13);
      y += 29;
      return;
    }

    rows.forEach((row, rowIndex) => {
      const contents = columns.map((col, i) =>
        doc.splitTextToSize(text(row[i]), Math.max(20, widths[i] - 10))
      );
      const lines = Math.max(1, ...contents.map(v => v.length));
      const height = Math.max(24, lines * 11 + 12);

      if (y + height > bottom) {
        nextPage();
        heading();
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(L, y, contentW, height, "F");
      }
      let x = L;
      contents.forEach((ls, i) => {
        font(8, i === 0, i === 0 ? navy : [47, 63, 91]);
        ls.forEach((str, j) => doc.text(str, x + 5, y + 13 + j * 11));
        x += widths[i];
      });
      y += height;
      divider();
    });
    y += 12;
  };

  drawTop();

  const selectedHotel = report.hotelFilter === "all"
    ? "All Owned Hotels"
    : (report.hotels || []).find(h => h.displayId === report.hotelFilter)?.name || report.hotelFilter;
  const generated = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  font(9, true);
  doc.text("REPORT SCOPE", L, y);
  y += 15;
  labelValue("Selected hotel", `${selectedHotel} (${report.hotelFilter})`);
  labelValue("Report period", `${String(report.period).toUpperCase()}: ${report.rangeStart} to ${report.rangeEnd}`);
  labelValue("Previous equivalent", `${report.previousRange?.start || "-"} to ${report.previousRange?.end || "-"}`);
  labelValue("Hotels in scope", `${qty(report.hotelCount)} of ${qty(report.totalOwnedHotels)} owned hotels`);
  labelValue("Generated on", generated);
  y += 16;

  const s = report.stats;
  section("Portfolio Performance", "Figures reflect the selected hotel(s) and date range");
  const metrics = [
    ["Net Collections", money(s.netCollections)],
    ["Total Bookings", qty(s.totalBookings)],
    ["Overnight Occupancy", rate(s.occupancyRate)],
    ["Cancellation Rate", rate(s.cancellationRate)],
    ["Collections / Available Room-Night", money(s.collectionsPerAvailableRoomNight)],
    ["Successful refunds basis", "Net Collections = successful payments minus refunds"],
    ["Sold / Available Room-Nights", `${qty(s.soldRoomNights)} / ${qty(s.availableRoomNights)}`],
    ["Current Rooms in Scope", qty(s.totalRoomsCount)],
    ["Previous Net Collections", money(s.netCollectionsPrev)],
    ["Previous Bookings", qty(s.totalBookingsPrev)],
  ];
  metrics.forEach(([a, b]) => labelValue(a, b));
  y += 12;

  section("Hotel Performance", "Owned hotels in scope; weighted occupancy uses room-nights");
  table([
    {label:"HOTEL / ID",width:149},
    {label:"BOOKINGS",width:55},
    {label:"NET INR",width:81},
    {label:"SOLD / AVAIL",width:83},
    {label:"OCC.",width:57},
    {label:"CANCEL",width:94},
  ], (report.hotelPerformance || []).map(h => [
    `${h.name} (${h.displayId})`, qty(h.totalBookings), money(h.netCollections),
    `${qty(h.soldRoomNights)} / ${qty(h.availableRoomNights)}`,
    rate(h.occupancyRate), rate(h.cancellationRate),
  ]), "No hotels in the selected portfolio scope.");

  section("Net Collections Trend", "This period vs the previous equivalent; in INR", 64);
  table([
    {label:"BUCKET",width:125},
    {label:"DATE START",width:116},
    {label:"DATE END",width:116},
    {label:"CURRENT INR",width:81},
    {label:"PREV INR",width:81},
  ], (report.revenueTrend || []).map(t => [
    t.label, t.start, t.end, money(t.thisPeriod), money(t.lastPeriod),
  ]));

  section("Booking Trend", "Bookings by scheduled check-in date");
  table([
    {label:"BUCKET",width:171},
    {label:"DATE START",width:149},
    {label:"DATE END",width:149},
    {label:"COUNT",width:50},
  ], (report.bookingTrend || []).map(t => [t.label, t.start, t.end, qty(t.count)]));

  section("Booking Status Breakdown", "Bookings checked in during the selected range");
  table([
    {label:"STATUS",width:249},
    {label:"BOOKINGS",width:135},
    {label:"SHARE",width:135},
  ], (report.bookingStatusBreakdown || []).map(v => [
    String(v.status).replace(/_/g, " "), qty(v.count), rate(v.pct),
  ]));

  section("Monthly Performance Summary", "Last six calendar months, independent of the selected date range");
  table([
    {label:"MONTH",width:79},
    {label:"NET INR",width:93},
    {label:"BOOKINGS",width:64},
    {label:"OCCUP.",width:67},
    {label:"INR / SOLD",width:109},
    {label:"INR / AVAIL",width:107},
  ], (report.monthlySummary || []).map(m => [
    m.month, money(m.netCollections), qty(m.bookings), rate(m.occupancyRate),
    money(m.collectionsPerSoldRoomNight), money(m.collectionsPerAvailableRoomNight),
  ]));

  ensure(32);
  font(8, false, muted);
  doc.text("Scope: owned hotels only. Monthly summary is historical and not limited to the selected date range.", L, y + 12);

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...line);
    doc.line(L, H - 32, R, H - 32);
    font(8, false, muted);
    doc.text("HMS  /  SUPER ADMIN REPORTS", L, H - 19);
    doc.text(`Page ${page} of ${totalPages}`, R, H - 19, { align: "right" });
  }

  const safeScope = String(report.hotelFilter || "all").replace(/[^a-zA-Z0-9-]/g, "");
  doc.save(`portfolio-reports-${safeScope}-${report.rangeStart}-to-${report.rangeEnd}.pdf`);
}