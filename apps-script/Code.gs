/**
 * Google Apps Script Web App Backend for "Sistem Input Nilai"
 * Handles:
 * 1. action: "ping" -> Health check
 * 2. action: "scan" -> Gemini 1.5 Flash Vision OCR for multi-page student exam sheets
 * 3. action: "saveResult" -> Writes student answers to Google Sheets preserving all formula columns
 * 4. action: "saveKey" -> Writes answer key and essay max scores to Row 9
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Tidak ada data POST yang diterima' });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var clientToken = data.token || '';

    // Verify Secret Token
    var scriptProps = PropertiesService.getScriptProperties();
    var serverToken = scriptProps.getProperty('SECRET_TOKEN');

    // If serverToken is configured, enforce matching
    if (serverToken && serverToken.trim() !== '') {
      if (clientToken !== serverToken) {
        return createJsonResponse({ status: 'error', message: 'Autentikasi gagal: Token rahasia tidak cocok' });
      }
    }

    switch (action) {
      case 'ping':
        return handlePing();

      case 'scan':
        return handleScan(data, scriptProps);

      case 'saveResult':
        return handleSaveResult(data, scriptProps);

      case 'saveKey':
        return handleSaveKey(data, scriptProps);

      default:
        return createJsonResponse({ status: 'error', message: 'Aksi tidak dikenal: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  return createJsonResponse({
    status: 'ok',
    message: 'Backend Google Apps Script Sistem Input Nilai aktif. Gunakan method POST.'
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * PING - Health Check
 */
function handlePing() {
  return createJsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Koneksi ke Google Apps Script berhasil!'
  });
}

/**
 * SCAN - Calls Gemini API with exam images
 */
function handleScan(data, scriptProps) {
  var apiKey = scriptProps.getProperty('GEMINI_API_KEY') || data.apiKey;
  if (!apiKey) {
    return createJsonResponse({
      status: 'error',
      message: 'GEMINI_API_KEY belum dikonfigurasi di Script Properties Google Apps Script'
    });
  }

  var images = data.images || [];
  if (images.length === 0 && data.image) {
    images = [{ base64: data.image, mimeType: 'image/jpeg' }];
  }

  if (images.length === 0) {
    return createJsonResponse({ status: 'error', message: 'Tidak ada gambar yang dikirim untuk di-scan' });
  }

  var model = data.model || 'gemini-1.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var parts = [];
  // Prompt instructions
  parts.push({
    text: "Anda adalah asisten AI pemeriksa lembar ujian SD. Siswa MENYILANG (X) atau melingkari huruf opsi A, B, C, atau D pada kertas soal.\n" +
          "Huruf opsi yang tertimpa tanda silang adalah jawaban siswa. Jangan menebak jika tidak terbaca.\n" +
          "Jika ada 2 silang/coretan, pilih yang paling jelas final dengan confidence lebih rendah dan beri catatan.\n" +
          "Jika kosong kembalikan null.\n" +
          "Kembalikan HANYA JSON murni dengan format:\n" +
          "{\n" +
          "  \"detectedStudentName\": null,\n" +
          "  \"detectedSubject\": null,\n" +
          "  \"questions\": [\n" +
          "    {\"no\": 1, \"jawaban\": \"A\", \"confidence\": 0.95, \"catatan\": \"\"}\n" +
          "  ]\n" +
          "}"
  });

  // Attach images
  for (var i = 0; i < images.length; i++) {
    parts.push({
      inline_data: {
        mime_type: images[i].mimeType || 'image/jpeg',
        data: images[i].base64
      }
    });
  }

  var payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var resCode = res.getResponseCode();
  var resText = res.getContentText();

  if (resCode !== 200) {
    return createJsonResponse({
      status: 'error',
      message: 'Gemini API Error (' + resCode + '): ' + resText
    });
  }

  var parsedRes = JSON.parse(resText);
  var rawOutput = parsedRes.candidates[0].content.parts[0].text;
  var jsonCleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
  var scanResult = JSON.parse(jsonCleaned);

  return createJsonResponse({
    status: 'ok',
    data: scanResult
  });
}

/**
 * SAVE RESULT - Writes student answers to spreadsheet
 * Rule: Preserves formulas from column AH onwards (like =IF(C10=C$9,1,0) and Na column).
 * Writes ONLY columns A, B, and C..LastAnswerCol in a single batch setValues().
 */
function handleSaveResult(data, scriptProps) {
  var ss = getSpreadsheet(data, scriptProps);
  var sheetName = data.sheetName;
  if (!sheetName) {
    return createJsonResponse({ status: 'error', message: 'Parameter sheetName wajib disertakan' });
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return createJsonResponse({
      status: 'error',
      message: 'Sheet "' + sheetName + '" tidak ditemukan di Spreadsheet!'
    });
  }

  var layout = data.layout || {};
  var keyRow = layout.keyRow || 9;
  var firstStudentRow = layout.firstStudentRow || 10;
  var firstAnswerColLetter = layout.firstAnswerCol || 'C';
  var firstAnswerColIndex = colLetterToIndex(firstAnswerColLetter); // 3 for 'C'

  var studentName = (data.studentName || '').trim();
  var studentRoll = data.studentRoll || 1;
  var answers = data.answers || []; // array of PG answers: ['A', 'B', ...]
  var uraianScores = data.uraianScores || []; // array of numbers: [3, 2, ...]

  var totalAnswerCount = answers.length + uraianScores.length;
  if (totalAnswerCount === 0) {
    return createJsonResponse({ status: 'error', message: 'Tidak ada data jawaban yang dikirim' });
  }

  // Find target row
  var lastRow = Math.max(sheet.getLastRow(), firstStudentRow + 40);
  var nameRange = sheet.getRange(firstStudentRow, 2, lastRow - firstStudentRow + 1, 1).getValues();

  var targetRow = -1;
  var firstAvailableRow = -1;

  for (var i = 0; i < nameRange.length; i++) {
    var rowNum = firstStudentRow + i;
    var currentName = (nameRange[i][0] || '').toString().trim();

    // Check if existing student matches name (case-insensitive)
    if (studentName && currentName.toLowerCase() === studentName.toLowerCase()) {
      targetRow = rowNum;
      break;
    }

    // Identify first empty or placeholder row (e.g. "CONTO" or empty)
    if (firstAvailableRow === -1) {
      if (!currentName || currentName.toUpperCase() === 'CONTO' || currentName.toUpperCase() === 'CONTOH') {
        firstAvailableRow = rowNum;
      }
    }
  }

  if (targetRow === -1) {
    targetRow = (firstAvailableRow !== -1) ? firstAvailableRow : (firstStudentRow + nameRange.length);
  }

  // Construct batch array for columns A, B, and C..LastAnswerCol
  // Col 1 = No Urut
  // Col 2 = Nama Siswa
  // Col 3..(3 + totalAnswerCount - 1) = Jawaban PG + Skor Uraian
  var rowValues = [];
  rowValues.push(studentRoll);
  rowValues.push(studentName);

  for (var p = 0; p < answers.length; p++) {
    rowValues.push(answers[p] !== null && answers[p] !== undefined ? answers[p] : '');
  }

  for (var u = 0; u < uraianScores.length; u++) {
    rowValues.push(uraianScores[u] !== null && uraianScores[u] !== undefined ? uraianScores[u] : '');
  }

  // Batch write: exactly 1 row, rowValues.length columns starting at Col 1 (A)
  var targetRange = sheet.getRange(targetRow, 1, 1, rowValues.length);
  targetRange.setValues([rowValues]);

  return createJsonResponse({
    status: 'ok',
    message: 'Nilai ' + studentName + ' berhasil disimpan di baris ' + targetRow + ' sheet "' + sheetName + '"',
    row: targetRow,
    columnsWritten: rowValues.length
  });
}

/**
 * SAVE KEY - Writes answer keys and essay max scores to row 9
 */
function handleSaveKey(data, scriptProps) {
  var ss = getSpreadsheet(data, scriptProps);
  var sheetName = data.sheetName;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return createJsonResponse({ status: 'error', message: 'Sheet "' + sheetName + '" tidak ditemukan' });
  }

  var layout = data.layout || {};
  var keyRow = layout.keyRow || 9;
  var firstAnswerColLetter = layout.firstAnswerCol || 'C';
  var firstCol = colLetterToIndex(firstAnswerColLetter);

  var keys = data.keys || [];
  var uraianMaxScores = data.uraianMaxScores || [];

  // Update Header if provided
  if (data.subjectName) {
    sheet.getRange('C5').setValue(': ' + data.subjectName.toUpperCase());
  }
  if (data.className) {
    sheet.getRange('C6').setValue(': ' + data.className.toUpperCase());
  }

  var keyValues = [];
  for (var i = 0; i < keys.length; i++) {
    keyValues.push(keys[i] || '');
  }
  for (var j = 0; j < uraianMaxScores.length; j++) {
    keyValues.push(uraianMaxScores[j] || '');
  }

  if (keyValues.length > 0) {
    sheet.getRange(keyRow, firstCol, 1, keyValues.length).setValues([keyValues]);
  }

  return createJsonResponse({
    status: 'ok',
    message: 'Kunci jawaban dan skor maksimal berhasil disimpan di baris ' + keyRow + ' sheet "' + sheetName + '"'
  });
}

function getSpreadsheet(data, scriptProps) {
  var ssId = data.spreadsheetId || scriptProps.getProperty('SPREADSHEET_ID');
  if (ssId && ssId.trim() !== '') {
    return SpreadsheetApp.openById(ssId.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function colLetterToIndex(colLetter) {
  colLetter = colLetter.toUpperCase();
  var sum = 0;
  for (var i = 0; i < colLetter.length; i++) {
    sum *= 26;
    sum += (colLetter.charCodeAt(i) - ('A'.charCodeAt(0) - 1));
  }
  return sum;
}
