// Đọc file Excel (.xlsx) hoặc CSV thành mảng các dòng, chỉ dùng thư viện có sẵn của Node.
// .xlsx là file zip chứa XML: đọc danh mục zip, giải nén sheet đầu tiên và bảng chuỗi dùng chung.
const zlib = require("zlib");

class SpreadsheetError extends Error { constructor(code) { super(code); this.code = code; } }

const MAX_ENTRY_BYTES = 20 * 1024 * 1024; // chặn file zip "bom" giải nén ra quá lớn

function readZipEntries(buffer) {
  // Tìm "End of central directory" (chữ ký 0x06054b50) ở cuối file
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new SpreadsheetError("NOT_XLSX");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new SpreadsheetError("BROKEN_XLSX");
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressed, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  const read = (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.size > MAX_ENTRY_BYTES) throw new SpreadsheetError("XLSX_TOO_LARGE");
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new SpreadsheetError("BROKEN_XLSX");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + entry.compressed);
    if (entry.method === 0) return data.toString("utf8");
    if (entry.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES }).toString("utf8");
    throw new SpreadsheetError("UNSUPPORTED_XLSX");
  };
  return { names: [...entries.keys()], read };
}

const decodeXml = (text) => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&");
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
const columnIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

function readXlsx(buffer) {
  const zip = readZipEntries(buffer);
  const shared = [];
  const sst = zip.read("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  // Sheet đầu tiên theo thứ tự trong workbook
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = zip.read("xl/workbook.xml");
  const rels = zip.read("xl/_rels/workbook.xml.rels");
  const first = workbook && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook);
  if (first && rels) {
    const rel = new RegExp(`<Relationship\\b[^>]*Id="${first[1]}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${first[1]}"`).exec(rels);
    if (rel) sheetPath = rel[1].startsWith("/") ? rel[1].slice(1) : `xl/${rel[1].replace(/^\.\//, "")}`;
  }
  const sheet = zip.read(sheetPath);
  if (!sheet) throw new SpreadsheetError("NO_SHEET");
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1]; const inner = cell[2] || "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs);
      const type = (/\bt="([^"]+)"/.exec(attrs) || [])[1];
      const index = ref ? columnIndex(ref[1]) : row.length;
      const raw = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(inner);
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw !== undefined) value = decodeXml(raw);
      row[index] = String(value).trim();
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return rows;
}

function readCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim()); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function readSpreadsheet(buffer, filename = "") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new SpreadsheetError("EMPTY_FILE");
  const isZip = buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (/\.xlsx$/i.test(filename) || isZip) {
    if (!isZip) throw new SpreadsheetError("NOT_XLSX");
    return readXlsx(buffer);
  }
  if (/\.csv$/i.test(filename)) return readCsv(buffer);
  throw new SpreadsheetError("UNSUPPORTED_FILE");
}

module.exports = { readSpreadsheet, readXlsx, readCsv, SpreadsheetError };
