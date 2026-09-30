import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function readZipEntries(buffer) {
  let entries = [];
  let eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset === -1) return entries;
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  let totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
    let method = buffer.readUInt16LE(pos + 10);
    let compSize = buffer.readUInt32LE(pos + 20);
    let fnLen = buffer.readUInt16LE(pos + 28);
    let extraLen = buffer.readUInt16LE(pos + 30);
    let commentLen = buffer.readUInt16LE(pos + 32);
    let localOffset = buffer.readUInt32LE(pos + 42);
    let filename = buffer.toString('utf8', pos + 46, pos + 46 + fnLen);
    let localHeader = localOffset;
    let localFnLen = buffer.readUInt16LE(localHeader + 26);
    let localExtraLen = buffer.readUInt16LE(localHeader + 28);
    let dataOffset = localHeader + 30 + localFnLen + localExtraLen;
    let compData = buffer.slice(dataOffset, dataOffset + compSize);
    entries.push({ filename, method, compData });
    pos += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

const templateDir = 'sheets_templates/ANALISIS_ASTS_KELAS 4';
const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  console.log('\n======================================');
  console.log('FILE:', file);
  const buf = fs.readFileSync(path.join(templateDir, file));
  const entries = readZipEntries(buf);
  function getFile(name) {
    const e = entries.find(x => x.filename === name);
    if (!e) return null;
    if (e.method === 0) return e.compData;
    if (e.method === 8) return zlib.inflateRawSync(e.compData);
    return null;
  }
  const wbXml = getFile('xl/workbook.xml')?.toString('utf8');
  const sheetMatches = [...(wbXml?.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"/g) || [])];
  console.log('Sheets:', sheetMatches.map(m => m[1]).join(', '));
  
  // check sheet1 row 7, 8, 9, 10
  const sheet1Xml = getFile('xl/worksheets/sheet1.xml')?.toString('utf8');
  if (sheet1Xml) {
    const r7 = sheet1Xml.match(/<row r="7"[^>]*>(.*?)<\/row>/)?.[1] || '';
    const r8 = sheet1Xml.match(/<row r="8"[^>]*>(.*?)<\/row>/)?.[1] || '';
    const r9 = sheet1Xml.match(/<row r="9"[^>]*>(.*?)<\/row>/)?.[1] || '';
    const r10 = sheet1Xml.match(/<row r="10"[^>]*>(.*?)<\/row>/)?.[1] || '';
    const getCols = (rowStr) => [...rowStr.matchAll(/<c r="([A-Z]+)\d+"/g)].map(x => x[1]).slice(0, 10).join(', ');
    console.log('Row 8 cols:', getCols(r8));
    console.log('Row 9 cols:', getCols(r9));
    console.log('Row 10 cols:', getCols(r10));
  }
}

