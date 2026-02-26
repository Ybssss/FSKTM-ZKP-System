import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateEvaluationPDF = (evaluation) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // Primary green
  doc.text('UTHM FSKTM', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Postgraduate Research Symposium', 105, 30, { align: 'center' });
  doc.text('Evaluation Report', 105, 38, { align: 'center' });

  // Student Info
  doc.setFontSize(12);
  doc.text('Student Information', 20, 55);
  doc.setFontSize(10);
  doc.text(`Name: ${evaluation.studentId?.name || 'N/A'}`, 20, 63);
  doc.text(`Matric Number: ${evaluation.studentId?.matricNumber || 'N/A'}`, 20, 70);
  doc.text(`Program: ${evaluation.studentId?.program || 'N/A'}`, 20, 77);
  doc.text(`Research Title: ${evaluation.studentId?.researchTitle || 'N/A'}`, 20, 84);

  // Evaluation Details
  doc.setFontSize(12);
  doc.text('Evaluation Details', 20, 100);
  doc.setFontSize(10);
  doc.text(`Session: ${evaluation.sessionType}`, 20, 108);
  doc.text(`Semester: ${evaluation.semester}`, 20, 115);
  doc.text(`Date: ${new Date(evaluation.date).toLocaleDateString()}`, 20, 122);
  doc.text(`Evaluator: ${evaluation.evaluatorId?.name || 'N/A'}`, 20, 129);

  // Overall Score
  doc.setFillColor(16, 185, 129);
  doc.rect(150, 100, 40, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(evaluation.overallScore.toString(), 170, 120, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Overall Score', 170, 127, { align: 'center' });

  // Criteria Scores Table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text('Detailed Evaluation', 20, 145);

  const tableData = evaluation.criteria?.map(c => [
    c.name,
    `${c.weight}%`,
    c.score.toString(),
    c.comments
  ]) || [];

  doc.autoTable({
    startY: 150,
    head: [['Criterion', 'Weight', 'Score', 'Comments']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 20 },
      2: { cellWidth: 20 },
      3: { cellWidth: 100 },
    },
  });

  // Overall Comments
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text('Overall Comments', 20, finalY);
  doc.setFontSize(10);
  const splitComments = doc.splitTextToSize(evaluation.overallComments || 'No comments', 170);
  doc.text(splitComments, 20, finalY + 8);

  // Recommendations
  const commentsHeight = splitComments.length * 5;
  doc.setFontSize(12);
  doc.text('Recommendations', 20, finalY + commentsHeight + 15);
  doc.setFontSize(10);
  const splitRecs = doc.splitTextToSize(evaluation.recommendations || 'No recommendations', 170);
  doc.text(splitRecs, 20, finalY + commentsHeight + 23);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
  doc.text('This is a system-generated document', 105, 290, { align: 'center' });

  // Save
  const filename = `Evaluation_${evaluation.studentId?.matricNumber}_${new Date(evaluation.date).toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};