import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

export type CertificatePdfInput = {
  code: string;
  recipientName: string;
  programTitle: string;
  issuedAt: Date;
  /** Public page the QR code opens: /verify-certificate?code=… */
  verifyUrl: string;
};

// Brand colours (docs/DESIGN.md tokens; PDFs can't read CSS)
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  bg: hex('#0A1B16'),
  panel: hex('#0D231D'),
  mint: hex('#7DFFC0'),
  line: hex('#1F5E57'),
  ivory: hex('#F0EDE4'),
  sub: hex('#A9C2BC'),
  brass: hex('#D9B56E'),
  white: rgb(1, 1, 1),
};

// Logo mark from public/assets/brand/alpha-logo-icon.svg (200×200 viewBox)
const LOGO_HEX = 'M100 9 L181 55 L181 145 L100 191 L19 145 L19 55 Z';
const LOGO_A = 'M48 139 L83 66 L98 66 L133 139 L113 139 L91 91 L69 139 Z';
const LOGO_R = 'M105 67 H140 Q159 67 159 88 Q159 104 144 109 L162 139 H139 L118 104 H137 Q145 104 145 93 Q145 84 136 84 H113 Z';

const issueDate = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });

/** Standard PDF fonts only cover Western characters: anything else prints as "?" instead of failing. */
function encodable(font: PDFFont, text: string) {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = C.ivory, maxWidth = 640) {
  const safe = encodable(font, text);
  let s = size;
  while (s > 10 && font.widthOfTextAtSize(safe, s) > maxWidth) s -= 1;
  page.drawText(safe, { x: (page.getWidth() - font.widthOfTextAtSize(safe, s)) / 2, y, size: s, font, color });
}

function spaced(text: string) {
  return text.split('').join(' ');
}

/** A4 landscape certificate with the brand mark and a QR code that opens the public verification page. */
export async function renderCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate ${input.code}`);
  doc.setAuthor('Alpha Recovery');
  doc.setSubject(`${input.programTitle}: ${input.recipientName}`);
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const page = doc.addPage([841.89, 595.28]);
  const { width: W, height: H } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.bg });
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, color: C.panel, borderColor: C.mint, borderWidth: 1.5 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: C.line, borderWidth: 0.75 });

  // Logo + wordmark, centred at the top
  const logoSize = 54;
  const scale = logoSize / 200;
  const wordmarkW = bold.widthOfTextAtSize('RECOVERY', 20);
  const groupW = logoSize + 14 + wordmarkW;
  const lx = (W - groupW) / 2;
  const ly = H - 62;
  page.drawSvgPath(LOGO_HEX, { x: lx, y: ly, scale, borderColor: C.mint, borderWidth: 12 }); // the path scale also scales the stroke
  page.drawSvgPath(LOGO_A, { x: lx, y: ly, scale, color: C.white });
  page.drawSvgPath(LOGO_R, { x: lx, y: ly, scale, color: C.mint });
  page.drawText('ALPHA', { x: lx + logoSize + 14, y: ly - 24, size: 20, font: bold, color: C.white });
  page.drawText('RECOVERY', { x: lx + logoSize + 14, y: ly - 46, size: 20, font: bold, color: C.mint });

  centered(page, spaced('CERTIFICATE OF COMPLETION'), H - 172, bold, 15, C.brass);
  page.drawLine({ start: { x: W / 2 - 60, y: H - 186 }, end: { x: W / 2 + 60, y: H - 186 }, thickness: 1, color: C.brass });
  centered(page, 'This certifies that', H - 226, regular, 14, C.sub);
  centered(page, input.recipientName, H - 280, serif, 40, C.ivory);
  page.drawLine({ start: { x: W / 2 - 220, y: H - 296 }, end: { x: W / 2 + 220, y: H - 296 }, thickness: 0.75, color: C.line });
  centered(page, 'has successfully completed the training program', H - 330, regular, 14, C.sub);
  centered(page, input.programTitle, H - 366, bold, 24, C.mint);

  // Footer: issue date and ID on the left, QR code on the right
  page.drawText('ISSUED', { x: 72, y: 118, size: 9, font: bold, color: C.brass });
  page.drawText(issueDate(input.issuedAt), { x: 72, y: 100, size: 13, font: regular, color: C.ivory });
  page.drawText('CERTIFICATE ID', { x: 72, y: 74, size: 9, font: bold, color: C.brass });
  page.drawText(input.code, { x: 72, y: 56, size: 13, font: bold, color: C.ivory });

  const qr = QRCode.create(input.verifyUrl, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const qrSize = 92;
  const quiet = 6;
  const cell = (qrSize - quiet * 2) / n;
  const qx = W - 72 - qrSize;
  const qy = 60;
  page.drawRectangle({ x: qx, y: qy, width: qrSize, height: qrSize, color: C.white });
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col)) {
        page.drawRectangle({ x: qx + quiet + col * cell, y: qy + qrSize - quiet - (row + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: C.bg });
      }
    }
  }
  const verifyLabel = 'Scan to verify';
  page.drawText(verifyLabel, { x: qx + (qrSize - regular.widthOfTextAtSize(verifyLabel, 9)) / 2, y: qy - 13, size: 9, font: regular, color: C.sub });
  const host = encodable(regular, new URL(input.verifyUrl).host + '/verify-certificate');
  page.drawText(host, { x: qx + qrSize - regular.widthOfTextAtSize(host, 8), y: qy + qrSize + 8, size: 8, font: regular, color: C.sub });

  return doc.save();
}
