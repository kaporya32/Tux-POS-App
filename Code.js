// fth sfht el HTML k shashat kashir sria3a
function doGet() {
  return HtmlService.createHtmlOutputFromFile('CashierUI')
      .setTitle('Tux POS - Cashier')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// dalat astqbal el order mn sfht el HTML w thdith el m5zn w el shyt foran
function submitOrderToServer(orderData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var wsS = ss.getSheetByName("Daily Sales");
    var wsB = ss.getSheetByName("Order Board");
    var wsSt = ss.getSheetByName("Stock");
    
    var items = orderData.items; 
    var cashPaid = orderData.cashPaid || 0;
    var instaPaid = orderData.instaPaid || 0;
    var visaPaid = orderData.visaPaid || 0;
    var discount = orderData.discount || 0;
    var workerName = orderData.worker || "Staff";
    
    var orderNum = Number(wsS.getLastRow());
    if(orderNum < 1) orderNum = 1; else orderNum++;
    
    var summary = "";
    for(var i = 0; i < items.length; i++) {
      summary += items[i].qty + "x " + items[i].name + ", ";
      AddQtySold(wsSt, items[i].name, items[i].qty);
    }
    if (summary.length > 2) summary = summary.substring(0, summary.length - 2);
    
    // tsgl fe Daily Sales
    var nextRowS = wsS.getLastRow() + 1;
    wsS.getRange(nextRowS, 1, 1, 8).setValues([[orderNum, new Date(), cashPaid, instaPaid, visaPaid, discount, "Completed", workerName]]);
    
    // tsgl fe Order Board
    var nextRowB = wsB.getLastRow() + 1;
    wsB.getRange(nextRowB, 1, 1, 5).setValues([[orderNum, summary, new Date(), "Preparing", workerName]]);
    
    SpreadsheetApp.flush();
    return { success: true, orderNum: orderNum };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function AddQtySold(wsSt, itemName, qty) {
  var data = wsSt.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(itemName).trim().toLowerCase()) {
      var currentSold = Number(wsSt.getRange(i + 1, 3).getValue()) || 0;
      wsSt.getRange(i + 1, 3).setValue(currentSold + qty);
      return;
    }
  }
}
