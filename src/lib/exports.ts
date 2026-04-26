import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const VAYASE_NAVY: [number, number, number] = [8, 16, 37];
const VAYASE_ACCENT: [number, number, number] = [73, 191, 255];

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(...VAYASE_NAVY);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(...VAYASE_ACCENT);
  doc.rect(0, 38, 210, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('VAYASE', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(73, 191, 255);
  doc.text('CONSULTING', 14, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 33);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(subtitle, 196, 33, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

function footer(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`VAYASE Consulting — ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 290);
    doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: 'right' });
  }
}

export function generatePaymentReceipt(data: {
  reference: string;
  clientName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod?: string;
  contractNumber?: string;
}) {
  const doc = new jsPDF();
  header(doc, 'REÇU DE PAIEMENT', `N° ${data.reference}`);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Émis à :', 14, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, 14, 62);

  doc.setFont('helvetica', 'bold');
  doc.text('Date :', 130, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(data.paymentDate), 'dd/MM/yyyy'), 130, 62);

  // Amount box
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(14, 80, 182, 40, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('MONTANT REÇU', 24, 92);
  doc.setFontSize(28);
  doc.setTextColor(...VAYASE_NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${data.currency}`, 24, 110);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: 135,
    theme: 'plain',
    body: [
      ['Mode de paiement', data.paymentMethod || 'Non spécifié'],
      ['Contrat associé', data.contractNumber || '—'],
      ['Référence', data.reference],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 60 } },
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    'Ce reçu confirme la bonne réception du paiement ci-dessus. Merci de votre confiance.',
    14, 250, { maxWidth: 180 }
  );

  footer(doc);
  doc.save(`recu-${data.reference}.pdf`);
}

export function generateClientsReport(clients: any[]) {
  const doc = new jsPDF();
  header(doc, 'RAPPORT CLIENTS', `${clients.length} client(s)`);

  autoTable(doc, {
    startY: 50,
    head: [['Nom', 'Email', 'Pays', 'Visa', 'Statut']],
    body: clients.map(c => [
      c.full_name,
      c.email || '—',
      c.destination_country || '—',
      c.visa_type || '—',
      c.status,
    ]),
    headStyles: { fillColor: VAYASE_NAVY, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });

  footer(doc);
  doc.save(`rapport-clients-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateFinanceReport(payments: any[], summary: { total: number; paid: number; pending: number; overdue: number }) {
  const doc = new jsPDF();
  header(doc, 'RAPPORT FINANCIER', format(new Date(), 'MMMM yyyy'));

  // Summary cards
  const cards = [
    { label: 'Total', value: summary.total },
    { label: 'Payé', value: summary.paid },
    { label: 'En attente', value: summary.pending },
    { label: 'En retard', value: summary.overdue },
  ];
  cards.forEach((c, i) => {
    const x = 14 + i * 47;
    doc.setFillColor(245, 248, 252);
    doc.roundedRect(x, 50, 43, 24, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(c.label, x + 4, 58);
    doc.setFontSize(11);
    doc.setTextColor(...VAYASE_NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${c.value.toLocaleString('fr-FR')} EUR`, x + 4, 68);
    doc.setFont('helvetica', 'normal');
  });

  autoTable(doc, {
    startY: 85,
    head: [['Date', 'Référence', 'Montant', 'Mode', 'Statut']],
    body: payments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'dd/MM/yyyy') : '—',
      p.reference || '—',
      `${Number(p.amount).toLocaleString('fr-FR')} ${p.currency}`,
      p.payment_method || '—',
      p.status,
    ]),
    headStyles: { fillColor: VAYASE_NAVY, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });

  footer(doc);
  doc.save(`rapport-finance-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportToExcel(data: any[], filename: string, sheetName = 'Données') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
