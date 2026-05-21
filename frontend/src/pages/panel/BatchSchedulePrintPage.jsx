import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { ArrowLeft, Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function BatchSchedulePrintPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState("pdf");
  const printRef = useRef(null);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [batchSearch, setBatchSearch] = useState("");

  const parseStartTimeToMinutes = (timeRange = "") => {
    const startTime = String(timeRange).split(/[–-]/)[0].trim().toLowerCase();

    const match = startTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);

    if (!match) return Number.MAX_SAFE_INTEGER;

    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const meridiem = match[3];

    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  const sortRowsByTime = (rows = []) => {
    return [...rows].sort((a, b) => {
      const timeDiff =
        parseStartTimeToMinutes(a.time) - parseStartTimeToMinutes(b.time);

      if (timeDiff !== 0) return timeDiff;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  };

  const sortedSchedules = useMemo(() => {
    return schedules.map((schedule) => ({
      ...schedule,
      rows: sortRowsByTime(schedule.rows || []),
    }));
  }, [schedules]);

  const filteredAvailableBatches = useMemo(() => {
    const term = batchSearch.trim().toLowerCase();
    if (!term) return availableBatches;

    return availableBatches.filter((batch) =>
      [
        batch.batchName,
        batch.batchId,
        batch.academicSession,
        batch.scheduleTitle,
        batch.googleMeetLink,
        batch.sessionTypes?.join(" "),
        batch.earliestDate
          ? new Date(batch.earliestDate).toLocaleDateString("en-MY")
          : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [availableBatches, batchSearch]);


  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadAvailableBatches();

        if (batchId) {
          await loadSelectedSchedules([batchId]);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [batchId]);

  const getPrintStyles = () => `
  body {
    font-family: Arial, sans-serif;
    background: white;
    color: black;
    margin: 0;
    padding: 10mm;
  }

  .print-form {
    width: 100%;
  }

  h1, h2, p {
    margin-top: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th, td {
    border: 1px solid #333;
    padding: 6px;
    vertical-align: top;
  }

  th {
    background: #f3f4f6;
    font-weight: bold;
    text-align: left;
  }

  .text-center {
    text-align: center;
  }

  .font-bold {
    font-weight: bold;
  }

  .font-semibold {
    font-weight: 600;
  }

  .mb-4 {
    margin-bottom: 16px;
  }

  .mb-5 {
    margin-bottom: 20px;
  }

  .mt-8 {
    margin-top: 32px;
  }

  .text-xs {
    font-size: 11px;
  }

  .text-lg {
    font-size: 18px;
  }

  .text-xl {
    font-size: 20px;
  }

  .text-2xl {
    font-size: 24px;
  }

  @page {
    size: A4 landscape;
    margin: 10mm;
  }
`;

  const handlePrintFormOnly = () => {
    if (!printRef.current) {
      alert("Printable form is not ready.");
      return;
    }

    window.print();
  };

  const handleExportPdf = async () => {
    if (!sortedSchedules.length) {
      alert("Please select at least one batch.");
      return;
    }
    const formElement = printRef.current;

    if (!formElement) {
      alert("Printable form is not ready.");
      return;
    }

    const canvas = await html2canvas(formElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = margin;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      pdf.addPage();
      position = margin - (imgHeight - heightLeft);
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const fileName =
      sortedSchedules.length === 1
        ? `${sortedSchedules[0].batchName || "batch-schedule"}-${
            sortedSchedules[0].date || ""
          }.pdf`
        : `selected-batch-schedules-${new Date().toISOString().slice(0, 10)}.pdf`;

    pdf.save(fileName.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_"));
  };

  const handleExportXlsx = () => {
    if (!sortedSchedules.length) {
      alert("Please select at least one batch.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const summaryData = [
      ["Batch Name", "Batch ID", "Date", "Google Meet Link", "Total Sessions"],
      ...sortedSchedules.map((schedule) => [
        schedule.batchName,
        schedule.batchId,
        `${schedule.dateDisplay} (${schedule.dayName})`,
        schedule.googleMeetLink,
        schedule.rows?.length || 0,
      ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 24 },
      { wch: 45 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    sortedSchedules.forEach((schedule, index) => {
      const headers = [
        "Time",
        "Name",
        "Matric No.",
        "Year of Study",
        "Prog",
        "Examiner 1",
        "Examiner 2",
        "Supervisor",
        "Title of Research",
      ];

      const rows = schedule.rows || [];

      const data = [
        [
          schedule.academicSession
            ? `(${schedule.academicSession}) ${schedule.title}`
            : schedule.title,
        ],
        [schedule.title],
        [`Session: ${schedule.batchName || "-"}`],
        [`Date: ${schedule.dateDisplay || "-"} (${schedule.dayName || "-"})`],
        [`GMLink: ${schedule.googleMeetLink || "-"}`],
        [],
        headers,
        ...rows.map((row) => [
          row.time || "",
          row.name || "",
          row.matricNumber || "",
          row.yearOfStudy || "",
          row.program || "",
          row.examiner1 || "",
          row.examiner2 || "",
          row.supervisor || "",
          row.researchTitle || "",
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);

      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } },
      ];

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 },
        { wch: 28 },
        { wch: 28 },
        { wch: 28 },
        { wch: 60 },
      ];

      const safeSheetName = `${index + 1}-${schedule.batchName || "Batch"}`
        .replace(/[\\/?*[\]:]/g, "")
        .slice(0, 31);

      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    const fileName =
      sortedSchedules.length === 1
        ? `${sortedSchedules[0].batchName || "batch-schedule"}.xlsx`
        : `selected-batch-schedules-${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, fileName.replace(/[^\w.-]+/g, "_"));
  };

  const loadAvailableBatches = async () => {
    const res = await api.get("/timetables/batches");
    const batches = res.data.batches || [];
    setAvailableBatches(batches);

    if (batchId) {
      setSelectedBatchIds([batchId]);
    }
  };

  const loadSelectedSchedules = async (ids = selectedBatchIds) => {
    if (!ids.length) {
      setSchedules([]);
      return;
    }

    const res = await api.get(
      `/timetables/batches/print?batchIds=${ids
        .map((id) => encodeURIComponent(id))
        .join(",")}`,
    );

    setSchedules(res.data.schedules || []);
  };

  const handleDownload = () => {
    if (exportFormat === "xlsx") {
      handleExportXlsx();
    } else {
      handleExportPdf();
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center">Loading printable schedule...</div>
    );
  }

  const hasSelectedSchedules = schedules.length > 0;

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      <style>
        {`
    @media print {
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      html,
      body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      body * {
        visibility: hidden !important;
      }

      #batch-schedule-print-area,
      #batch-schedule-print-area * {
        visibility: visible !important;
      }

      #batch-schedule-print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: white !important;
      }

      .no-print {
        display: none !important;
        visibility: hidden !important;
      }

      #batch-schedule-print-area table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto;
      }

      #batch-schedule-print-area tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      #batch-schedule-print-area th,
      #batch-schedule-print-area td {
        border: 1px solid #333 !important;
      }
    }
  `}
      </style>

      <div className="no-print sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={() => navigate("/panel/sessions")}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white font-bold"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel XLSX</option>
            </select>

            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="no-print max-w-7xl mx-auto mt-6 bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold">Available Batches</h2>
            <p className="text-xs text-gray-500 font-semibold">
              Search and tick one or multiple batches to preview/export.
            </p>
          </div>

          <input
            type="text"
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
            placeholder="Search batch, ID, date, type, link..."
            className="w-full md:w-96 px-3 py-2 border rounded-lg bg-gray-50 font-semibold text-sm"
          />
        </div>

        <div className="max-h-80 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredAvailableBatches.map((batch) => (
            <label
              key={batch.batchId}
              className={`border rounded-lg p-3 cursor-pointer ${
                selectedBatchIds.includes(batch.batchId)
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedBatchIds.includes(batch.batchId)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedBatchIds, batch.batchId]
                      : selectedBatchIds.filter((id) => id !== batch.batchId);

                    setSelectedBatchIds(next);
                    loadSelectedSchedules(next);
                  }}
                  className="mt-1"
                />

                <div>
                  <p className="font-bold text-gray-900">{batch.batchName}</p>
                  <p className="text-xs text-gray-500">{batch.batchId}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(batch.earliestDate).toLocaleDateString("en-MY")} ·{" "}
                    {batch.totalSessions} session(s)
                  </p>
                  <p className="text-xs text-blue-700 truncate max-w-xs">
                    {batch.googleMeetLink}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <main
        id="batch-schedule-print-area"
        ref={printRef}
        className="print-form print-sheet max-w-7xl mx-auto my-6 bg-white p-8 shadow rounded print:rounded-none"
      >
        {!hasSelectedSchedules && (
          <div className="text-center text-gray-500 font-semibold py-16">
            Select one or more batches above to preview and download the
            schedule.
          </div>
        )}
        {sortedSchedules.map((schedule, index) => (
          <section
            key={schedule.batchId}
            className={index > 0 ? "mt-10 pt-8 border-t page-break-before" : ""}
          >
            {schedule.academicSession && (
              <h1 className="text-xl font-bold mb-4">
                ({schedule.academicSession}) {schedule.title}
              </h1>
            )}

            <h2 className="text-lg font-bold mb-4">{schedule.title}</h2>

            <div className="mb-5 space-y-1">
              <p className="text-2xl font-bold">
                Session: {schedule.batchName}
              </p>
              <p className="font-semibold">
                Date: {schedule.dateDisplay} ({schedule.dayName})
              </p>
              <p className="font-semibold">
                GMLink: {schedule.googleMeetLink || "-"}
              </p>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-700 p-2 text-left">Time</th>
                  <th className="border border-gray-700 p-2 text-left">Name</th>
                  <th className="border border-gray-700 p-2 text-left">
                    Matric No.
                  </th>
                  <th className="border border-gray-700 p-2 text-left">
                    Year of Study
                  </th>
                  <th className="border border-gray-700 p-2 text-left">Prog</th>
                  <th className="border border-gray-700 p-2 text-left">
                    Examiner 1
                  </th>
                  <th className="border border-gray-700 p-2 text-left">
                    Examiner 2
                  </th>
                  <th className="border border-gray-700 p-2 text-left">
                    Supervisor
                  </th>
                  <th className="border border-gray-700 p-2 text-left">
                    Title of Research
                  </th>
                </tr>
              </thead>

              <tbody>
                {(schedule.rows || []).map((row) => (
                  <tr key={`${schedule.batchId}-${row.no}-${row.matricNumber}`}>
                    <td className="border border-gray-700 p-2 whitespace-nowrap">
                      {row.time}
                    </td>
                    <td className="border border-gray-700 p-2 font-semibold">
                      {row.name}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.matricNumber}
                    </td>
                    <td className="border border-gray-700 p-2 text-center">
                      {row.yearOfStudy}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.program}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.examiner1}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.examiner2}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.supervisor}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {row.researchTitle || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );
}
