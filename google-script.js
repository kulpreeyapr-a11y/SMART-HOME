function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var event = e.parameter.event;
  // บันทึก [วันเวลา, ชื่อเหตุการณ์]
  sheet.appendRow([new Date(), event]);
  return ContentService.createTextOutput("Success");
}
