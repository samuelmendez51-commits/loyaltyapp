// src/utils/printerHelper.ts — LoyaltyClub Reusable ESC/POS Printer Helper
// ─────────────────────────────────────────────────────────────────────────────

export function cleanText(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function centerText(text: string, width: number): string {
  if (text.length >= width) return text + "\n";
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text + "\n";
}

export function wrapText(text: string, limit: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= limit) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.slice(0, limit);
      let rem = word.slice(limit);
      while (rem.length > limit) {
        lines.push(currentLine);
        currentLine = rem.slice(0, limit);
        rem = rem.slice(limit);
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function formatItemRow(qty: string, desc: string, price: string, width: number, largeFontItems: boolean, fontSize?: string): Buffer[] {
  qty = cleanText(qty);
  desc = cleanText(desc);
  price = cleanText(price);

  const is32 = width === 32;
  const colQtyStart = 0;
  const colQtyWidth = 5;
  
  const colPriceWidth = is32 ? 8 : 9;
  const colDescWidth = width - colQtyWidth - colPriceWidth;

  const wrapLimit = largeFontItems ? Math.floor(colDescWidth / 2) : colDescWidth;
  const descLines = wrapText(desc, wrapLimit);
  
  const resultBuffers: Buffer[] = [];

  for (let i = 0; i < descLines.length; i++) {
    const parts: Buffer[] = [];

    if (i === 0) {
      parts.push(Buffer.from(qty.padEnd(colQtyWidth).substring(0, colQtyWidth), 'latin1'));

      const isDoubleHeight = fontSize === 'DOBLE_ALTO' || fontSize === 'doble_alto';
      const resetCmd = isDoubleHeight ? [0x1B, 0x21, 0x10] : [0x1B, 0x21, 0x00];

      if (largeFontItems) {
        parts.push(Buffer.from([0x1B, 0x21, 0x30]));
        const lineDesc = descLines[i].padEnd(wrapLimit).substring(0, wrapLimit);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(resetCmd));

        const remainingForPrice = width - colQtyWidth - (wrapLimit * 2);
        parts.push(Buffer.from(price.padStart(remainingForPrice).substring(0, remainingForPrice) + '\n', 'latin1'));
      } else {
        const lineDesc = descLines[i].padEnd(colDescWidth).substring(0, colDescWidth);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(price.padStart(colPriceWidth).substring(0, colPriceWidth) + '\n', 'latin1'));
      }
    } else {
      parts.push(Buffer.from(' '.repeat(colQtyWidth), 'latin1'));

      const isDoubleHeight = fontSize === 'DOBLE_ALTO' || fontSize === 'doble_alto';
      const resetCmd = isDoubleHeight ? [0x1B, 0x21, 0x10] : [0x1B, 0x21, 0x00];

      if (largeFontItems) {
        parts.push(Buffer.from([0x1B, 0x21, 0x30]));
        const lineDesc = descLines[i].padEnd(wrapLimit).substring(0, wrapLimit);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(resetCmd));

        const remainingSpaces = width - colQtyWidth - (wrapLimit * 2);
        parts.push(Buffer.from(' '.repeat(remainingSpaces) + '\n', 'latin1'));
      } else {
        const lineDesc = descLines[i].padEnd(colDescWidth).substring(0, colDescWidth);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(' '.repeat(colPriceWidth) + '\n', 'latin1'));
      }
    }

    resultBuffers.push(Buffer.concat(parts));
  }

  return resultBuffers;
}

export function formatOrderTicket(orderData: any, config: any): Buffer {
  const paperWidth = config.paper_width;
  const largeFontItems = !!config.large_font_items;
  const tieneAutocorte = !!config.tiene_autocorte;

  const lineWidth = Number(paperWidth) === 32 ? 32 : 48;
  const divider = "-".repeat(lineWidth) + "\n";
  const dividerDouble = "=".repeat(lineWidth) + "\n";

  const parts: Buffer[] = [];
  const fontSize = config.fontSize || config.tamano_fuente;

  // Initialize printer (ESC @)
  parts.push(Buffer.from([0x1B, 0x40]));
  // BEEP: Command 30 (0x1E)
  parts.push(Buffer.from([30]));
  // Character page WPC1252 (ESC t 16)
  parts.push(Buffer.from([0x1B, 0x74, 0x10]));

  // Set Global Font Size
  const isDoubleHeight = fontSize === 'DOBLE_ALTO' || fontSize === 'doble_alto';
  parts.push(Buffer.from(isDoubleHeight ? [0x1B, 0x21, 0x10] : [0x1B, 0x21, 0x00]));

  // Center alignment (ESC a 1)
  parts.push(Buffer.from([0x1B, 0x61, 0x01]));

  // Print Header
  if (orderData.subtitle) {
    parts.push(Buffer.from(cleanText(orderData.subtitle + "\n"), 'latin1'));
  }
  if (orderData.title) {
    parts.push(Buffer.from(cleanText(orderData.title + "\n"), 'latin1'));
  }
  if (orderData.tenant) {
    parts.push(Buffer.from(cleanText("TENANT: " + orderData.tenant + "\n"), 'latin1'));
  }
  if (orderData.fecha) {
    parts.push(Buffer.from(cleanText("FECHA: " + orderData.fecha + "\n"), 'latin1'));
  }

  // Left alignment (ESC a 0)
  parts.push(Buffer.from([0x1B, 0x61, 0x00]));

  // Metadata block (Folio, Cliente, Servicio)
  if (orderData.folio || orderData.cliente || orderData.servicio) {
    parts.push(Buffer.from("\n", 'latin1'));
    if (orderData.folio) {
      parts.push(Buffer.from(cleanText("FOLIO: #" + orderData.folio).padEnd(lineWidth).substring(0, lineWidth) + "\n", 'latin1'));
    }
    if (orderData.cliente) {
      parts.push(Buffer.from(cleanText("CLIENTE: " + orderData.cliente).padEnd(lineWidth).substring(0, lineWidth) + "\n", 'latin1'));
    }
    if (orderData.servicio) {
      parts.push(Buffer.from(cleanText("SERVICIO: " + orderData.servicio).padEnd(lineWidth).substring(0, lineWidth) + "\n", 'latin1'));
    }
  }

  // Items Table
  parts.push(Buffer.from(divider, 'latin1'));
  parts.push(Buffer.concat(formatItemRow("CANT", "DESCRIPCION", "IMPORTE", lineWidth, false, fontSize)));
  parts.push(Buffer.from(divider, 'latin1'));

  if (orderData.items && Array.isArray(orderData.items)) {
    for (const item of orderData.items) {
      parts.push(Buffer.concat(formatItemRow(item.qty || "1", item.name || "", item.price || "", lineWidth, largeFontItems, fontSize)));
      
      // If item has special notes
      if (item.notes && item.notes.trim()) {
        const cleanNotes = cleanText(item.notes.trim());
        const notesLimit = lineWidth - 7; // 5 spaces + '* ' = 7
        const notesLines = wrapText(cleanNotes, notesLimit);
        for (let j = 0; j < notesLines.length; j++) {
          const prefix = j === 0 ? "     * " : "       ";
          const lineText = prefix + notesLines[j];
          parts.push(Buffer.from(lineText.padEnd(lineWidth).substring(0, lineWidth) + "\n", 'latin1'));
        }
      }
    }
  }

  parts.push(Buffer.from(divider, 'latin1'));

  // Total Row
  if (orderData.total) {
    let totalLine = "";
    const colPriceWidth = lineWidth === 32 ? 8 : 9;
    const colLabelWidth = lineWidth - colPriceWidth;
    totalLine = cleanText("TOTAL:".padStart(colLabelWidth) + orderData.total.padStart(colPriceWidth));
    parts.push(Buffer.from(totalLine + "\n", 'latin1'));
    parts.push(Buffer.from(dividerDouble, 'latin1'));
  }

  // Feed lines before cutting
  parts.push(Buffer.from("\n\n\n\n", 'latin1'));

  // Autocut if configured
  if (tieneAutocorte) {
    parts.push(Buffer.from([0x1D, 0x56, 0x42, 0x00]));
  }

  return Buffer.concat(parts);
}
