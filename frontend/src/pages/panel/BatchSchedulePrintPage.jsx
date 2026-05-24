import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ArrowLeft, Download, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../services/api";

const formatDateOnly = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}/${date.getFullYear()}`;
};

const formatDayName = (value) => {
  if (!value) return "";

  let date;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  if (!date) date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-MY", { weekday: "long" });
};

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

const getScheduleDateLine = (schedule) => {
  const display = schedule.dateDisplay || formatDateOnly(schedule.date || schedule.earliestDate);
  const dayName = schedule.dayName || formatDayName(schedule.date || schedule.earliestDate);

  if (!display && !dayName) return "Date: -";
  if (!dayName) return `Date: ${display}`;
  if (!display) return `Date: ${dayName}`;
  return `Date: ${display} (${dayName})`;
};

const sortRowsByTime = (rows = []) =>
  [...rows].sort((a, b) => {
    const diff = parseStartTimeToMinutes(a.time) - parseStartTimeToMinutes(b.time);
    if (diff !== 0) return diff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

export default function BatchSchedulePrintPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [batchSearch, setBatchSearch] = useState("");

  const sortedSchedules = useMemo(
    () =>
      schedules.map((schedule) => ({
        ...schedule,
        rows: sortRowsByTime(schedule.rows || []),
      })),
    [schedules],
  );

  const filteredBatches = useMemo(() => {
    const term = batchSearch.toLowerCase().trim();
    if (!term) return availableBatches;

    return availableBatches.filter((batch) =>
      [
        batch.batchName,
        batch.batchId,
        batch.sessionType,
        batch.academicSession,
        formatDateOnly(batch.date || batch.earliestDate),
        batch.googleMeetLink,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [availableBatches, batchSearch]);

  const loadAvailableBatches = async () => {
    const res = await api.get("/timetables/batches");
    const batches = res.data.batches || [];
    setAvailableBatches(batches);
    return batches;
  };

  const loadSelectedSchedules = async (ids) => {
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadAvailableBatches();

        if (batchId) {
          setSelectedBatchIds([batchId]);
          await loadSelectedSchedules([batchId]);
        }
      } catch (error) {
        alert(error.response?.data?.message || "Failed to load batch schedule.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [batchId]);

  const toggleBatch = async (id, checked) => {
    const next = checked
      ? [...new Set([...selectedBatchIds, id])]
      : selectedBatchIds.filter((batchId) => batchId !== id);

    setSelectedBatchIds(next);
    await loadSelectedSchedules(next);
  };

  const handleExportPdf = async () => {
    if (!sortedSchedules.length) return alert("Please select at least one batch.");
    if (!printRef.current) return alert("Printable form is not ready.");

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

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
        ? `${sortedSchedules[0].batchName || "batch-schedule"}-${sortedSchedules[0].date || ""}.pdf`
        : `selected-batch-schedules-${new Date().toISOString().slice(0, 10)}.pdf`;

    pdf.save(fileName.replace(/[^\w.-]+/g, "_"));
  };

  const handleExportXlsx = () => {
    if (!sortedSchedules.length) return alert("Please select at least one batch.");

    const workbook = XLSX.utils.book_new();
    const summaryData = [
      ["Batch Name", "Batch ID", "Date", "Google Meet Link", "Total Sessions"],
      ...sortedSchedules.map((schedule) => [
        schedule.batchName || "",
        schedule.batchId || "",
        getScheduleDateLine(schedule).replace(/^Date:\s*/, ""),
        schedule.googleMeetLink || "",
        schedule.rows?.length || 0,
      ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 45 }, { wch: 15 }];
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

      const data = [
        [schedule.academicSession ? `(${schedule.academicSession}) ${schedule.title || schedule.scheduleTitle || ""}` : schedule.title || ""],
        [schedule.title || schedule.scheduleTitle || "Postgraduate Progress Presentation Schedule"],
        [`Session: ${schedule.batchName || "-"}`],
        [getScheduleDateLine(schedule)],
        [`GMLink: ${schedule.googleMeetLink || "-"}`],
        [],
        headers,
        ...(schedule.rows || []).map((row) => [
          row.time || "",
          row.name || "",
          row.matricNumber || row.matricNo || "",
          row.yearOfStudy || "",
          row.program || "",
          row.examiner1 || "",
          row.examiner2 || "",
          row.supervisor || "",
          row.researchTitle || row.titleOfResearch || row.title || "",
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);
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

  const handleDownload = () => {
    if (exportFormat === "xlsx") handleExportXlsx();
    else handleExportPdf();
  };

  if (loading) return <div className="p-10 text-center">Loading printable schedule...</div>;

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      <style>{`
        .page-break-before { page-break-before: always; break-before: page; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          #batch-schedule-print-area, #batch-schedule-print-area * { visibility: visible !important; }
          #batch-schedule-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm font-semibold"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel XLSX</option>
            </select>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
        </div>
      </div>

      <div className="no-print max-w-7xl mx-auto mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h2 className="font-bold text-gray-900">Available Batches</h2>
            <p className="text-xs text-gray-500">Select one or more batches to export.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              placeholder="Search batch, date, type, link..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pr-1">
          {filteredBatches.map((batch) => (
            <label
              key={batch.batchId}
              className={`p-3 rounded-lg border text-sm cursor-pointer ${
                selectedBatchIds.includes(batch.batchId)
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedBatchIds.includes(batch.batchId)}
                  onChange={(e) => toggleBatch(batch.batchId, e.target.checked)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{batch.batchName}</p>
                  <p className="text-xs text-gray-500 truncate">{batch.batchId}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatDateOnly(batch.date || batch.earliestDate) || "No date"} · {batch.totalSessions || batch.sessionCount || 0} session(s)
                  </p>
                  <p className="text-xs text-blue-700 truncate">{batch.googleMeetLink}</p>
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
        {!sortedSchedules.length && (
          <div className="text-center text-gray-500 p-10">Select at least one batch to preview.</div>
        )}

        {sortedSchedules.map((schedule, index) => (
          <section
            key={schedule.batchId}
            className={index > 0 ? "mt-10 pt-8 border-t page-break-before" : ""}
          >
            {schedule.academicSession && (
              <h1 className="text-xl font-bold mb-4">
                ({schedule.academicSession}) {schedule.title || schedule.scheduleTitle}
              </h1>
            )}

            <h2 className="text-lg font-bold mb-4">
              {schedule.title || schedule.scheduleTitle || "Postgraduate Progress Presentation Schedule"}
            </h2>

            <div className="mb-5 space-y-1">
              <p className="text-2xl font-bold">Session: {schedule.batchName}</p>
              <p className="font-semibold">{getScheduleDateLine(schedule)}</p>
              <p className="font-semibold">GMLink: {schedule.googleMeetLink || "-"}</p>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {[
                    "Time",
                    "Name",
                    "Matric No.",
                    "Year of Study",
                    "Prog",
                    "Examiner 1",
                    "Examiner 2",
                    "Supervisor",
                    "Title of Research",
                  ].map((header) => (
                    <th key={header} className="border border-gray-700 p-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(schedule.rows || []).map((row, rowIndex) => (
                  <tr key={`${schedule.batchId}-${rowIndex}`}>
                    <td className="border border-gray-700 p-2">{row.time}</td>
                    <td className="border border-gray-700 p-2">{row.name}</td>
                    <td className="border border-gray-700 p-2">{row.matricNumber || row.matricNo}</td>
                    <td className="border border-gray-700 p-2">{row.yearOfStudy || ""}</td>
                    <td className="border border-gray-700 p-2">{row.program}</td>
                    <td className="border border-gray-700 p-2">{row.examiner1}</td>
                    <td className="border border-gray-700 p-2">{row.examiner2}</td>
                    <td className="border border-gray-700 p-2">{row.supervisor}</td>
                    <td className="border border-gray-700 p-2">
                      {row.researchTitle || row.titleOfResearch || row.title || "–"}
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
