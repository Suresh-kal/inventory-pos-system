const PDFDocument = require("pdfkit");
const fs = require("fs");

function generateInvoice(saleItems, total, user) {

    const doc = new PDFDocument();

    const fileName = `invoice-${Date.now()}.pdf`;

    const filePath = `./invoices/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

   
    doc.fontSize(26).text("Suresh Mobile Center", {
        align: "center",
    });

    doc.fontSize(22).text("Inventory POS Invoice", {
        align: "center",
    });

    doc.moveDown();

    
    const formattedDate = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });

   
    const invoiceNumber = `INV-${Date.now()}`;

    doc.fontSize(14).text(`Date: ${formattedDate}`);
    doc.text(`Invoice No: ${invoiceNumber}`);
    doc.text(`Served By: ${user.name}`);

    doc.moveDown(2);


    let tableTop = doc.y;

doc.text("Product", 50, tableTop);

doc.text("Category", 220, tableTop);

doc.text("Qty", 330, tableTop);

doc.text("Price", 390, tableTop);

doc.text("Total", 470, tableTop);

    doc.moveDown();

   
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();

    let position = doc.y + 15;

  
    saleItems.forEach((item) => {

        doc.text(item.productName, 50, position);

doc.text(item.category, 220, position);

doc.text(item.quantity.toString(), 330, position);

doc.text(`Rs. ${item.priceAtSale}`, 390, position);

doc.text(`Rs. ${item.subtotal}`, 470, position);

        position += 30;
    });

    
    doc.moveTo(50, position)
       .lineTo(550, position)
       .stroke();

    position += 40;

    
    doc.fontSize(20)
       .text(`Grand Total: Rs. ${total}`, 50, position, {
            align: "right",
            width: 500,
       });

   
    doc.moveDown(2);

    doc.fontSize(14)
       .text("Thank you for shopping with us!", {
            align: "center",
       });

    doc.end();

    return fileName;
}

module.exports = generateInvoice;