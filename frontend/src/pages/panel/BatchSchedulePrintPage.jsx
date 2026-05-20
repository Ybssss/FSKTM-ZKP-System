import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { Printer, ArrowLeft, Download } from "lucide-react";

export default function BatchSchedulePrintPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    loadSchedule();
  }, [batchId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/timetables/batches/${encodeURIComponent(batchId)}/print`,
      );
      setSchedule(res.data.schedule);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Failed to load printable batch schedule.",
      );
    } finally {
      setLoading(false);
    }
  };

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
    const formElement = printRef.current;

    if (!formElement) {
      alert("Printable form is not ready.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      alert("Please allow pop-ups to print the form.");
      return;
    }

    printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${schedule?.batchName || "Batch Schedule"}</title>
        <style>${getPrintStyles()}</style>
      </head>
      <body>
        ${formElement.outerHTML}
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleExportPdf = async () => {
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
      `${schedule.batchName || "batch-schedule"}-${schedule.date || ""}.pdf`
        .replace(/[^\w.-]+/g, "_")
        .replace(/_+/g, "_");

    pdf.save(fileName);
  };

  if (loading) {
    return (
      <div className="p-10 text-center">Loading printable schedule...</div>
    );
  }

  if (!schedule) {
    return <div className="p-10 text-center">Schedule not found.</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }

            body {
              background: white !important;
            }

            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            .print-sheet {
              box-shadow: none !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: none !important;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
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
            <button
              onClick={handlePrintFormOnly}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={handleExportPdf}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <main
        ref={printRef}
        className="print-form print-sheet max-w-7xl mx-auto my-6 bg-white p-8 shadow rounded print:rounded-none"
      >
        {schedule.academicSession && (
          <h1 className="text-xl font-bold mb-4">
            ({schedule.academicSession}) {schedule.title}
          </h1>
        )}

        <h2 className="text-lg font-bold mb-4">{schedule.title}</h2>

        <div className="mb-5 space-y-1">
          <p className="text-2xl font-bold">Session: {schedule.batchName}</p>
          <p className="font-semibold">
            Date: {schedule.dateDisplay} ({schedule.dayName})
          </p>
          <p className="font-semibold">
            GMLink:{" "}
            {schedule.googleMeetLink ? (
              <a
                href={schedule.googleMeetLink}
                className="text-blue-700 underline"
                target="_blank"
                rel="noreferrer"
              >
                {schedule.googleMeetLink}
              </a>
            ) : (
              "-"
            )}
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
            {schedule.rows.map((row) => (
              <tr key={`${row.no}-${row.matricNumber}`}>
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
                <td className="border border-gray-700 p-2">{row.program}</td>
                <td className="border border-gray-700 p-2">{row.examiner1}</td>
                <td className="border border-gray-700 p-2">{row.examiner2}</td>
                <td className="border border-gray-700 p-2">{row.supervisor}</td>
                <td className="border border-gray-700 p-2">
                  {row.researchTitle || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 text-xs text-gray-500">
          Generated at: {new Date(schedule.generatedAt).toLocaleString("en-MY")}
        </div>
      </main>
    </div>
  );
}
