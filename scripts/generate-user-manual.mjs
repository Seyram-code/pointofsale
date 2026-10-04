import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const OUTPUT = path.resolve("docs/VidyPOS-User-Manual.pdf");
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const doc = new PDFDocument({ size: "LETTER", margins: { top: 48, bottom: 52, left: 54, right: 54 }, bufferPages: true, info: { Title: "VidyPOS User Manual", Author: "VidyPOS", Subject: "Step-by-step guide for VidyPOS store teams and platform administrators" } });
const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

const C = { ink: "#17212b", muted: "#5c6975", green: "#087f5b", greenLight: "#e8f5ef", line: "#d9e1e6", pale: "#f4f7f8", amber: "#986000", amberLight: "#fff4dc", red: "#a93232", redLight: "#fff0f0", white: "#ffffff", dark: "#111820", dark2: "#202832", cyan: "#b4ead1" };
const REAL_SCREENSHOTS = new Map([
  ["Dashboard overview", "dashboard.png"],
  ["POS product search and cart", "pos.png"],
  ["Products catalogue", "products.png"],
  ["Inventory workspace", "inventory.png"],
  ["Customer management", "customers.png"],
  ["Supplier management", "suppliers.png"],
  ["Sales list and detail", "sales.png"],
  ["Returns workspace", "returns.png"],
  ["Employee management", "employees.png"],
  ["Shift portal", "shifts.png"],
  ["Reports workspace", "reports.png"],
  ["Settings areas", "settings.png"],
  ["Subscription page", "subscription.png"],
]);
const PAGE_W = 612, PAGE_H = 792, LEFT = 54, RIGHT = 558, CONTENT_W = 504;
let pageNo = 0;

function text(str, x, y, opts = {}) {
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10).fillColor(opts.color ?? C.ink).text(str, x, y, { width: opts.width ?? CONTENT_W, lineGap: opts.lineGap ?? 2, continued: false, ...opts });
  return doc.y;
}
function rounded(x,y,w,h,r=8,fill=C.white,stroke=C.line){doc.roundedRect(x,y,w,h,r).fillAndStroke(fill,stroke);}
function header(kicker,title,subtitle){
  pageNo += 1;
  doc.addPage();
  doc.rect(0,0,PAGE_W,PAGE_H).fill(C.white);
  doc.rect(0,0,PAGE_W,8).fill(C.green);
  text(kicker.toUpperCase(),LEFT,29,{size:8,font:"Helvetica-Bold",color:C.green,charSpacing:1.2});
  text(title,LEFT,45,{size:25,font:"Helvetica-Bold",color:C.ink,width:CONTENT_W});
  text(subtitle,LEFT,78,{size:10,color:C.muted,width:CONTENT_W});
  doc.moveTo(LEFT,105).lineTo(RIGHT,105).strokeColor(C.line).lineWidth(1).stroke();
  doc.y=119;
}
function cover(){
  pageNo += 1;
  doc.rect(0,0,PAGE_W,PAGE_H).fill(C.dark);
  doc.rect(0,0,PAGE_W,12).fill(C.green);
  doc.roundedRect(54,70,58,58,15).fill(C.green);
  doc.font("Helvetica-Bold").fontSize(24).fillColor(C.white).text("M",71,82);
  text("VidyPOS",54,164,{size:16,font:"Helvetica-Bold",color:C.cyan});
  text("Store Operations\nUser Manual",54,194,{size:35,font:"Helvetica-Bold",color:C.white,width:465,lineGap:5});
  text("A practical, page-by-page guide for store owners, managers, cashiers and platform administrators.",56,293,{size:15,color:"#c6d0d8",width:430,lineGap:4});
  // Original schematic of the actual app navigation and dashboard, not a product screenshot.
  rounded(55,384,502,245,12,"#18222b","#35414b");
  doc.roundedRect(69,399,62,214,7,"#10171e","#10171e").fill();
  for(let i=0;i<8;i++) doc.roundedRect(81,416+i*23,37,13,4,i===0?C.green:"#29343d","#29343d").fill();
  text("Dashboard overview",149,411,{size:12,font:"Helvetica-Bold",color:C.white});
  const vals=["Sales","Transactions","Stock","Profit"];
  vals.forEach((v,i)=>{rounded(149+i*96,443,86,55,6,"#222e38","#34434d");text(v,157+i*96,451,{size:7,color:"#a9b7c1",width:70});doc.font("Helvetica-Bold").fontSize(13).fillColor(C.white).text(["GHS","24","11","GHS"][i],157+i*96,469,{width:70});});
  rounded(149,511,270,95,6,"#222e38","#34434d");text("Sales trend",161,522,{size:8,font:"Helvetica-Bold",color:"#d6dfe5"});
  [25,36,50,43,68,57,78].forEach((h,i)=>doc.rect(171+i*30,590-h,14,h).fill(i===6?C.cyan:C.green));
  rounded(429,511,114,95,6,"#222e38","#34434d");text("Payment mix",440,522,{size:8,font:"Helvetica-Bold",color:"#d6dfe5"});
  doc.circle(486,565,26).lineWidth(8).strokeColor(C.green).stroke();doc.circle(486,565,26).lineWidth(8).strokeColor("#3e91d1").stroke();
  text("Illustrated interface map",56,648,{size:8,color:"#9baab5"});
  text("Edition 1.0  |  2 October 2026",56,690,{size:10,color:"#b9c6cf"});
  text("Prepared from the current VidyPOS application workflows. Some options depend on assigned permissions and subscription plan.",56,713,{size:8,color:"#8797a3",width:490});
}
function callout(title,body,type="info"){
  const fill=type==="warning"?C.amberLight:type==="danger"?C.redLight:C.greenLight;
  const color=type==="warning"?C.amber:type==="danger"?C.red:C.green;
  const y=doc.y;doc.roundedRect(LEFT,y,CONTENT_W,10,5).fill(fill);
  text(title,LEFT+12,y+10,{size:9,font:"Helvetica-Bold",color,width:CONTENT_W-24});
  const end=text(body,LEFT+12,y+25,{size:9,color:C.ink,width:CONTENT_W-24,lineGap:2});
  const h=Math.max(48,end-y+10);doc.roundedRect(LEFT,y,CONTENT_W,h,7).fillAndStroke(fill,fill); // background under the text
  doc.fillColor(C.ink);
  // redraw text over the filled background
  text(title,LEFT+12,y+10,{size:9,font:"Helvetica-Bold",color,width:CONTENT_W-24});
  text(body,LEFT+12,y+25,{size:9,color:C.ink,width:CONTENT_W-24,lineGap:2});
  doc.y=y+h+10;
}
function steps(items){
  for(let i=0;i<items.length;i++){
    const y=doc.y;
    doc.circle(LEFT+10,y+7,9).fill(C.green);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.white).text(String(i+1),LEFT+7,y+3,{width:8,align:"center"});
    const end=text(items[i].title,LEFT+28,y,{size:10,font:"Helvetica-Bold",color:C.ink,width:CONTENT_W-30});
    const bodyEnd=text(items[i].body,LEFT+28,end+1,{size:9,color:C.muted,width:CONTENT_W-30,lineGap:2});
    doc.y=bodyEnd+10;
  }
}
function schematic(title, labels, caption){
  const screenshotName=REAL_SCREENSHOTS.get(title);
  const screenshotPath=screenshotName?path.resolve(`docs/manual-images/${screenshotName}`):null;
  if(screenshotPath && fs.existsSync(screenshotPath)){
    const y=doc.y,h=170;
    rounded(LEFT,y,CONTENT_W,h,9,C.dark,C.dark);
    doc.rect(LEFT,y,CONTENT_W,18).fill(C.dark2);
    doc.circle(LEFT+13,y+9,3).fill("#f06a6a");doc.circle(LEFT+24,y+9,3).fill("#f4c05d");doc.circle(LEFT+35,y+9,3).fill(C.green);
    text("LIVE VIDYPOS SCREEN • LOCAL DEMO DATA",LEFT+52,y+5,{size:7,font:"Helvetica-Bold",color:"#d7e2e9",width:420});
    doc.image(screenshotPath,LEFT+8,y+24,{fit:[300,138]});
    const noteX=LEFT+320;
    text(title,noteX,y+30,{size:9,font:"Helvetica-Bold",color:C.white,width:170});
    text("Captured from the authenticated VidyPOS page. Values and records reflect the local demo store.",noteX,y+55,{size:8,color:"#c1cdd5",width:166,lineGap:2});
    text(caption,noteX,y+101,{size:7,color:"#aab8c2",width:166,lineGap:2});
    doc.y=y+h+11;
    return;
  }
  const y=doc.y, h=132;
  rounded(LEFT,y,CONTENT_W,h,9,C.dark,C.dark);
  doc.rect(LEFT,y,CONTENT_W,17).fill(C.dark2);
  doc.circle(LEFT+13,y+9,3).fill("#f06a6a");doc.circle(LEFT+24,y+9,3).fill("#f4c05d");doc.circle(LEFT+35,y+9,3).fill(C.green);
  text(title,LEFT+52,y+4,{size:7,font:"Helvetica-Bold",color:"#d7e2e9",width:420});
  const navW=91;
  doc.rect(LEFT+8,y+25,navW,98).fill("#172129");
  ["Dashboard","POS","Products","Inventory","Sales","Reports"].forEach((label,i)=>{
    const yy=y+31+i*14;
    if(labels.includes(label)) doc.roundedRect(LEFT+14,yy-1,78,12,3).fill(C.green);
    text(label,LEFT+20,yy+1,{size:6.5,color:labels.includes(label)?C.white:"#9bacb7",width:68});
  });
  const cx=LEFT+112;
  text(title,cx,y+31,{size:10,font:"Helvetica-Bold",color:C.white,width:365});
  labels.filter(l=>!['Dashboard','POS','Products','Inventory','Sales','Reports'].includes(l)).slice(0,6).forEach((label,i)=>{
    const col=i%3,row=Math.floor(i/3), bx=cx+col*123,by=y+52+row*33;
    rounded(bx,by,113,26,4,"#26333d","#3b4a54");text(label,bx+7,by+8,{size:7,color:"#e0e8ed",width:100});
  });
  text(caption,LEFT,y+h+5,{size:7,color:C.muted,width:CONTENT_W});
  doc.y=y+h+22;
}
function page(kicker,title,subtitle,diagram,how,notes=[]){
  header(kicker,title,subtitle);
  if(diagram) schematic(diagram.title,diagram.labels,diagram.caption);
  steps(how);
  for(const n of notes) callout(n.title,n.body,n.type??"info");
}
function footer(){
  const range=doc.bufferedPageRange();
  for(let i=range.start;i<range.start+range.count;i++){
    doc.switchToPage(i);
    if(i===0) continue;
    const previousBottomMargin=doc.page.margins.bottom;
    doc.page.margins.bottom=12;
    doc.moveTo(LEFT,PAGE_H-36).lineTo(RIGHT,PAGE_H-36).strokeColor(C.line).lineWidth(.6).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(C.muted).text("VidyPOS User Manual  •  Store operations and platform administration",LEFT,PAGE_H-27,{width:390,lineBreak:false});
    doc.text(`${i+1} / ${range.count}`,RIGHT-65,PAGE_H-27,{width:65,align:"right",lineBreak:false});
    doc.page.margins.bottom=previousBottomMargin;
  }
}

cover();
header("Start here","How to use this manual","A route-by-route guide to the current VidyPOS screens. Follow only the sections available to your role.");
callout("Important","This manual documents the application as it exists on 2 October 2026. Buttons and page access vary by permissions, store plan, and subscription status.");
schematic("VidyPOS navigation (illustration)",["Dashboard","POS","Products","Inventory","Sales","Reports","Customers","Suppliers","Employees","Returns","Settings","Subscription","Help & Support"],"Sections marked LIVE VIDYPOS SCREEN use real authenticated captures with local demo data. Other schematics cover routes unavailable to the captured Starter account.");
steps([
 {title:"Find a page",body:"Use the left sidebar on desktop or the mobile navigation at the bottom of the app. The signed-in role determines which links appear."},
 {title:"Follow numbered steps",body:"Each page guide covers the common task sequence, what to check, and any permission or plan prerequisite."},
 {title:"Understand status messages",body:"Green or success messages confirm completion. Red errors mean the operation failed or needs correction. For imports, read the row-level issue details."},
 {title:"Get help",body:"Use Help & Support to submit a ticket with a category, priority, and clear description. Include the page and action that led to the issue."},
]);
callout("Security note","Never share your password. Sign out on shared devices. The app signs users out after a period of inactivity.","warning");

page("01 • Access","Register your store","Create the first owner account and start store setup.",{title:"Registration form",labels:["Business details","Business type","Contact information","Owner account","Choose your plan","Start free trial"],caption:"Registration creates the store and the first administrator account."},[
 {title:"Open Register",body:"From the public home page choose Start free trial. Enter the business name and choose the closest business type."},
 {title:"Enter store details",body:"Provide business phone and email, address, city, region, country, and currency. Registration number, logo URL, and tax settings may be optional depending on the field."},
 {title:"Create the owner login",body:"Enter owner name, email, phone, and a strong password. The password hint asks for uppercase, lowercase, a number, and a symbol."},
 {title:"Choose a plan and submit",body:"Select Starter, Premium, or Enterprise, review the displayed price, then choose Start 14-day free trial. Registration begins a 14-day trial on the selected package."},
 {title:"Sign in",body:"Use the owner email or staff code with the password to access the store portal."},
],[{title:"Initial tax setup",body:"New stores are initialized with default tax rates. Review Settings → Tax Rates before trading to confirm the active default rate is correct."}]);

page("02 • Access","Sign in and account menu","Authenticate, recover access, and reach personal settings.",{title:"Sign-in screen",labels:["Email or staff code","Password","Remember me","Forgot password","Sign in"],caption:"Remember me stores the identifier only; it does not store the password."},[
 {title:"Enter an identifier",body:"Type your email address or staff code in the identifier field."},
 {title:"Enter your password",body:"Use the password assigned to your account. Select Remember me only on a device you trust."},
 {title:"Submit sign-in",body:"Choose Sign in. If a protected page sent you here, successful authentication returns you to that destination when allowed."},
 {title:"Recover a password",body:"Choose Forgot password, enter the personal email registered to your account, and open the one-time reset link sent to that inbox. The link expires after 30 minutes. Staff without a personal email should ask a store administrator to reset their password."},
 {title:"Use the account menu",body:"The top-right menu contains My profile, Subscription (for store users), and Sign out. The bell opens notifications; the moon/sun control changes the theme."},
],[{title:"Inactivity",body:"Sessions expire after five minutes without activity. You may need to sign in again before continuing a sale or administrative task.",type:"warning"}]);

page("03 • Overview","Dashboard","Read today’s store activity and jump to a sale.",{title:"Dashboard overview",labels:["Today sales","Transactions","Products sold","Low stock","Profit","Sales trend","Payment methods","Make a Sale"],caption:"Numbers are calculated for the current store and the signed-in user's visibility."},[
 {title:"Review the summary",body:"Read today’s sales, transaction count, units sold, low-stock count, payment totals, and sales trend."},
 {title:"Check operational lists",body:"Review top products, expiring items, and recent transactions lower on the dashboard."},
 {title:"Start checkout",body:"Choose Make a Sale to open the POS terminal."},
 {title:"Respond to subscription warnings",body:"If a renewal warning appears, use its Subscription link to review plan status and access end date."},
],[{title:"Role-based totals",body:"Cashiers generally see their own sales. Users with broader reporting permissions can see store-wide figures. Profit appears only when the account has profit-report permission."}]);

page("04 • Sell","Make a Sale: find products","Build a cart with the correct items and quantities.",{title:"POS product search and cart",labels:["Search products","Category filters","Barcode field","Product list","Current sale","Customer","Checkout"],caption:"The POS can support keyboard wedge scanners and camera scanning when the plan allows it."},[
 {title:"Open Make a Sale",body:"Select Make a Sale from the sidebar. The POS loads product search, category filters, and the current sale cart."},
 {title:"Find an item",body:"Search by product name or choose a category. Where scanning is enabled, scan a barcode or type a code and press Enter."},
 {title:"Add products",body:"Select a product tile to add it to the cart. Repeat for every item. Check the product name and price before checkout."},
 {title:"Adjust the cart",body:"Use the cart controls to change quantities or remove a line. Use the customer action if customer lookup is available on the plan."},
 {title:"Apply allowed adjustments",body:"Use discount controls only when your role has discount permission. Hold a sale when the customer is not ready to pay."},
],[{title:"Plan restrictions",body:"Starter has no barcode scanning or customer management. Premium has POS scanning and customer management, but no camera scanning outside the sales page. Enterprise includes scanning in other product workflows too."}]);

page("05 • Sell","Checkout and receipts","Collect payment and complete the transaction.",{title:"Checkout dialog",labels:["Cart summary","Payment method","Amount","Confirm payment","Receipt"],caption:"The payment dialog displays the amount due and the selected payment method."},[
 {title:"Open checkout",body:"With products in the cart, choose Checkout. Confirm the total, tax, discount, and customer before taking payment."},
 {title:"Choose a payment method",body:"Select an available method such as cash, Mobile Money, card terminal, or card. Follow the prompts for that method."},
 {title:"Confirm payment",body:"Enter any requested tender details and submit. Wait for a success result before handing over goods."},
 {title:"Review the receipt",body:"Check the receipt details and print if needed. Keep the receipt number for later sales lookup or a return."},
 {title:"Handle declined or interrupted payment",body:"Do not assume a failed payment completed. Check the transaction status before retrying to avoid duplicate payment."},
],[{title:"Tax calculation",body:"Checkout uses each product's tax rate or the store's active default. Tax-exclusive products add tax on top of their entered price; tax-inclusive products extract tax from the entered price."},{title:"Offline sales",body:"Offline POS is not enabled on Starter or Premium. If disconnected, checkout cannot save an offline draft on those plans. Enterprise is configured for offline POS.",type:"warning"}]);

page("06 • Sell","Held sales","Park an unfinished cart and resume it later.",{title:"Held sales dialog",labels:["Current cart","Hold sale","Held sales list","Resume sale","Delete/clear"],caption:"A held sale is a draft, not a completed payment or recorded sale."},[
 {title:"Hold the current sale",body:"With items in the cart, choose Hold. Add a note if the interface requests one, then confirm the hold."},
 {title:"Open held sales",body:"Use the Held control or keyboard shortcut F4 to see drafts available to your account/store."},
 {title:"Resume a draft",body:"Select the held sale and choose Resume. Verify customer, items, quantities, and prices before checkout."},
 {title:"Complete or abandon",body:"Complete checkout to record the sale, or clear the draft if it is no longer needed."},
]);

page("07 • Catalogue","Products: browse and maintain","Search products, manage records, and create product backups.",{title:"Products catalogue",labels:["All products","Category tabs","Search name SKU barcode","Download backup","Import products","Add product","Edit/Delete"],caption:"The catalogue shows product identity, stock, prices, status, and permitted actions."},[
 {title:"Browse the catalogue",body:"Open Products. Use category tabs or search by product name, SKU, or barcode."},
 {title:"Add a product",body:"Choose Add product, enter name, optional SKU and barcode, cost price, selling price, opening quantity, and optional expiry date; then create the product."},
 {title:"Edit or delete",body:"Use the row action if your account has edit/delete permission. Deleted products are removed from the active catalogue but retained for historical sales."},
 {title:"Download a backup",body:"Choose Download product backup. The workbook includes non-deleted products, including inactive entries, and store-level product and stock details."},
 {title:"Understand imports",body:"Use the dedicated import template for compact imports. Imports add new products and skip duplicates rather than overwriting existing catalogue records."},
],[{title:"Permission note",body:"Import requires product-create permission. Some role configurations may show catalogue access without create permission; the server still blocks unauthorized imports."}]);

page("08 • Catalogue","Import products from Excel","Use the compact template or a full product backup workbook.",{title:"Product import template",labels:["Product name","Barcode (optional)","Cost price (GHS)","Selling price (GHS)","Opening quantity","Expiry date (optional)"],caption:"The importer reads the first worksheet and accepts common price header variants."},[
 {title:"Download the template",body:"On Products choose Download import template. Keep the six headers in the first row. Product name, cost price, selling price, and opening quantity are required; barcode and expiry date are optional."},
 {title:"Fill product rows",body:"Enter one product per row. Opening quantity may be zero. Enter a valid date for expiry when applicable. Leave optional barcode/expiry cells blank when not needed."},
 {title:"Choose Import products",body:"Select the .xlsx workbook in the file picker. The upload is limited to 10 MB and 5,000 product rows."},
 {title:"Review the result",body:"The result shows imported and skipped counts. Read row numbers and issue text. Existing SKUs/names and duplicate barcodes are skipped; unmatched references from full backups are not assigned."},
 {title:"Verify the catalogue",body:"Search for an imported product and confirm its barcode, prices, stock, and expiry details. Imported compact prices are tax-exclusive by default."},
],[{title:"Header and workbook compatibility",body:"The importer uses a worksheet named Products when present; otherwise it uses the first worksheet. It normalizes punctuation/currency decoration in headers and accepts aliases such as Cost, Buying Price, Unit Cost, Selling, Unit Price, and Retail Price."},{title:"Opening stock",body:"Imported stock is written to inventory. Positive opening quantity also records a purchase-receipt stock movement; an expiry date creates an opening product batch."}]);

page("09 • Stock","Inventory overview","Find stock risks and inspect stock value and movements.",{title:"Inventory workspace",labels:["Search","Category","Low stock","Out of stock","Stock value","Movements","Receive","Adjust"],caption:"Inventory figures are scoped to the current store."},[
 {title:"Open Inventory",body:"Use the sidebar. Search by product and apply category or stock-status filters."},
 {title:"Review low stock",body:"Open the low/out-of-stock view and use reorder levels to identify what needs replenishment."},
 {title:"Inspect a product",body:"Review current quantity, reserved quantity, and recent stock movements where available."},
 {title:"Receive stock",body:"Choose Receive, select product, enter received quantity and cost/details, then confirm. Verify the resulting stock balance."},
 {title:"Adjust stock",body:"Choose Adjust only after a physical count or documented correction. Enter the direction, quantity, and reason; verify the updated ledger."},
],[{title:"Audit discipline",body:"Use receive for new incoming goods and adjustment for corrections. Avoid using adjustments to hide missing purchase records."}]);

page("10 • Stock","Product expiry and batches","Track expiry where products are batch-managed.",{title:"Expiry/stock alert illustration",labels:["Expiring products","Expiry date","Batch quantity","Stock alert"],caption:"Expiry detail is available when batch records have expiry dates."},[
 {title:"Enter expiry when creating/importing stock",body:"Add an expiry date to a product batch when the product is perishable or regulated. Compact imports create an opening batch when the date is present."},
 {title:"Review dashboard alerts",body:"Check the expiring-products section on the dashboard and act before items reach expiry."},
 {title:"Verify stock changes",body:"After a return, receipt, or adjustment, inspect the stock balance and movement history for the corresponding change."},
],[{title:"Image note",body:"Some interface illustrations in this manual are schematics; this section describes current workflow behavior, not a separate batch-management screen."}]);

page("11 • Catalogue","Customers","Maintain customer records and use them during checkout.",{title:"Customer management",labels:["Search","Add customer","Contact details","Loyalty","Credit limit","Active status"],caption:"Available actions depend on customer view/manage permission and subscription plan."},[
 {title:"Open Customers",body:"Search by name, code, phone, or email. Select Apply; use Reset to clear the filter."},
 {title:"Add a customer",body:"If you have manage permission, choose Add and provide the required name plus optional contact, address, loyalty card, credit limit, and notes."},
 {title:"Edit or deactivate",body:"Use the row actions to update details or disable a customer. Deactivation preserves transaction history."},
 {title:"Use at checkout",body:"In POS, choose Add/Change customer and search. Confirm the customer before completing checkout."},
],[{title:"Plan restriction",body:"Customer management is not included with Starter. Premium and Enterprise include it. An upgrade notice appears if the current plan blocks the page."}]);

page("12 • Purchasing","Suppliers","Maintain supplier contact and credit details.",{title:"Supplier management",labels:["Search suppliers","Add supplier","Contact","Payment terms","Credit limit","Balance"],caption:"Supplier editing is permission- and plan-gated."},[
 {title:"Open Suppliers",body:"Search by supplier name, code, contact person, or phone/email."},
 {title:"Add a supplier",body:"With manage permission, enter name and any available contact, address, region, tax number, payment terms, credit limit, and notes."},
 {title:"Update or deactivate",body:"Use row actions to update contact details or disable a supplier when no longer active."},
 {title:"Review balances",body:"Use payment terms and balances as operational reference; confirm financial settlements through your own accounting process."},
],[{title:"Plan restriction",body:"Supplier management is not included with Starter. Premium and Enterprise include it."}]);

page("13 • Purchasing","Purchase orders","Review purchase-order status and totals.",{title:"Purchase order list",labels:["Search","Supplier filter","Status filter","Order number","Totals","Status"],caption:"The current Purchase Orders page is a review/list view."},[
 {title:"Open Purchase Orders",body:"Use search and filters to find an order by number, supplier, or status."},
 {title:"Review status and total",body:"Open or inspect the listed order details available on screen. Use totals/status counts to understand pending purchasing activity."},
 {title:"Follow up operationally",body:"For creating, receiving, editing, or cancelling orders, use the workflow available in your deployed version; these controls are not implemented on the current list page."},
],[{title:"Current limitation",body:"The current page is read-only despite a purchase-order manage permission existing in the access model. This manual does not describe create/receive actions that are not present in the app.",type:"warning"}]);

page("14 • Checkout follow-up","Sales","Search and inspect completed transactions.",{title:"Sales list and detail",labels:["Date range","Search receipt","Cashier filter","Sales list","Payment","Receipt details"],caption:"Visible transactions depend on sales-view permissions and cashier scope."},[
 {title:"Open Sales",body:"Set the date range or search by receipt/customer details. Apply available cashier/status filters."},
 {title:"Select a transaction",body:"Open a row to inspect products, quantities, amounts, payment method, and receipt details."},
 {title:"Use the receipt number",body:"Keep the receipt number available for support and returns. Search it from the Returns workflow when processing a return."},
 {title:"Export if available",body:"Use an export control only if it is visible for your account. Report exports are covered in the Reports section."},
],[{title:"Scope",body:"Cashiers typically see their own sales; users with Sales View All can see store-wide sales. The page currently returns a capped transaction list."}]);

page("15 • Customer care","Returns","Create a return, review approvals, and complete an eligible refund.",{title:"Returns workspace",labels:["Receipt lookup","Returned items","Quantity","Reason","Refund method","Submit","Approve/Reject"],caption:"Returns and refunds are available on Premium and Enterprise plans."},[
 {title:"Find the sale",body:"Choose New Return and enter the original receipt number. The system loads eligible items and remaining returnable quantities."},
 {title:"Select return items",body:"Choose items and quantities. Do not exceed available quantity; completed or already-returned units are excluded."},
 {title:"Enter return details",body:"Choose a reason and refund method, and confirm whether returned stock should be restocked."},
 {title:"Submit for review",body:"Submit the return. It may remain pending until an authorized approver approves or rejects it."},
 {title:"Approve and complete",body:"An approver reviews the request. Approved refunds can be completed; completion updates stock and sales summaries as appropriate."},
],[{title:"Plan restriction",body:"Starter does not include returns. Premium and Enterprise do. Refund execution depends on payment-provider support and the original transaction."}]);

page("16 • Workforce","Employees","Create and maintain staff accounts.",{title:"Employee management",labels:["Employee list","Add employee","Role","Password","Enable/disable","Staff limit"],caption:"Employee creation is controlled by permission and the store’s plan seat limit."},[
 {title:"Open Employees",body:"Review staff names, employee numbers, roles, and account status."},
 {title:"Create an employee",body:"Choose Add Employee. Enter name, email, temporary password, role, and optional position/department details."},
 {title:"Choose the least access needed",body:"Assign the role that matches the person’s duties. Administrators can manage staff; other managers cannot create an ADMIN account."},
 {title:"Manage the account",body:"Use password reset or enable/disable controls when permitted. Disabling an account prevents future sign-in."},
],[{title:"Seat limits",body:"Starter supports one staff account; Premium supports three; Enterprise is unlimited. The owner account counts toward the limit."}]);

page("17 • Workforce","Shifts and cash control","Open a register shift and close it with a cash count.",{title:"Shift portal",labels:["Active registers","Opening float","Open shift","Cash count","Close shift","Variance","History"],caption:"An open shift is useful for cash reconciliation; checkout does not currently require one."},[
 {title:"Open Shifts",body:"Choose the active register and enter the opening float and notes, then open the shift."},
 {title:"Trade during the shift",body:"Complete sales through POS and use the active register operationally. Keep cash movements and exceptions documented."},
 {title:"Close the shift",body:"Enter the counted cash and closing notes, review expected versus counted cash, then confirm close."},
 {title:"Review variance",body:"Investigate and document any difference between expected and counted values. Use recent shift history for context."},
],[{title:"Important",body:"The app currently allows checkout without an open shift, so sales made without one may not be associated with a shift. Shift history is store-level, not limited to the current cashier."}]);

page("18 • Analysis","Reports","Filter store performance and export or print summaries.",{title:"Reports workspace",labels:["Period","Date range","Cashier","Payment method","Product/category","Sales","Profit","Export CSV","Print/PDF"],caption:"Report scope follows the signed-in user’s report and sales permissions."},[
 {title:"Choose a reporting period",body:"Select daily, weekly, monthly, yearly, or a custom date range where available."},
 {title:"Apply filters",body:"Use payment method, cashier, product, or category filters to narrow the report."},
 {title:"Read the summary",body:"Review revenue, transaction counts, tax/payment summaries, profit where permitted, trends, and top products."},
 {title:"Export filtered data",body:"Choose CSV/Excel to download a spreadsheet-compatible CSV of the filtered data."},
 {title:"Print or save as PDF",body:"Choose Print/PDF and use the browser print dialog to print or select Save as PDF."},
],[{title:"Plan note",body:"Starter is described in plan configuration as one-month reporting without yearly history. Confirm the current subscription page for the live plan details; report-range enforcement may vary by deployment."},{title:"Data scope",body:"Users without Sales View All see their own sales rather than the full store."}]);

page("19 • Configuration","Settings and tax rates","Maintain store details and checkout tax configuration.",{title:"Settings areas",labels:["Store details","Receipt details","Tax rates","Default rate","Active/inactive","Save"],caption:"Management controls appear only with settings-manage permission."},[
 {title:"Open Settings",body:"Review business profile, contact, address, receipt details, currency, and other store-level information."},
 {title:"Update store details",body:"Edit permitted fields and save. Confirm receipt-facing details are accurate before printing customer receipts."},
 {title:"Review tax rates",body:"Open Tax Rates. Check the percentage, active state, and which rate is marked default."},
 {title:"Change the default",body:"Add or edit a tax rate, activate it if needed, and mark the correct rate as default. Confirm the rate on a test transaction."},
],[{title:"Tax behavior",body:"A product-linked tax rate takes precedence over the default. When no product rate is assigned, checkout uses the store’s active default tax rate. Imported compact prices default to tax-exclusive; tax is added on top at checkout."}]);

page("20 • Account","Profile","Check account identity, role, store, and plan information.",{title:"Profile page",labels:["Name","Email","Staff code","Role","Store","Plan","Account status"],caption:"The profile is reached from the top-right user menu."},[
 {title:"Open My profile",body:"Open the user menu in the top bar and choose My profile."},
 {title:"Verify identity",body:"Check full name, email, staff code, role, and store assignment."},
 {title:"Check access context",body:"Review the plan and account status. Ask an administrator to correct role/store details if they are wrong."},
]);

page("21 • Account","Subscription and plan upgrades","Review billing status and renew or change the store plan.",{title:"Subscription page",labels:["Current plan","Status","Access until","Choose plan","Payment method","Renew"],caption:"The subscription page remains available when shop access expires."},[
 {title:"Open Subscription",body:"Use the sidebar or the top-right account menu. Review current plan, status, billing period, and access end date."},
 {title:"Compare available plans",body:"Review the options and choose the package that includes the features and staff capacity you need."},
 {title:"Select a payment method",body:"For a paid plan, choose the offered payment method and provide required payment details such as a Mobile Money number."},
 {title:"Complete the renewal/change",body:"Submit the payment flow and wait for confirmation. Recheck subscription status and access period afterward."},
],[{title:"Expired stores",body:"When a subscription expires, shop pages are restricted. Subscription and Help & Support remain accessible. Gated feature pages may show an upgrade notice rather than redirecting."}]);

page("22 • Support","Help & Support","Raise support requests and follow the conversation.",{title:"Support ticket page",labels:["Subject","Category","Priority","Description","Submit ticket","Your tickets","Reply"],caption:"Support remains available even when a shop subscription is expired."},[
 {title:"Open Help & Support",body:"Choose Help & Support from the sidebar."},
 {title:"Describe the issue",body:"Enter a short subject, choose a category and priority, and describe what happened and what you expected. Include the page and approximate time."},
 {title:"Submit the ticket",body:"Choose Submit ticket. A confirmation appears after the ticket is accepted."},
 {title:"Track and reply",body:"Select a ticket from Your tickets to read the conversation and reply with additional details."},
]);

page("23 • Records","Audit logs","Review recent store events when authorized.",{title:"Audit log list",labels:["Date/time","User","Action","Entity","Summary","Filter/search"],caption:"The log is a review tool; it does not edit the recorded event."},[
 {title:"Open Audit Logs",body:"Use the sidebar if your role has audit-log access."},
 {title:"Review events",body:"Inspect user, action, affected entity, time, and summary to trace stock, account, or operational changes."},
 {title:"Follow up",body:"Use the relevant page to make a correction. The audit log itself is read-only."},
],[{title:"Plan behavior",body:"Audit logs are shown as included in plan configuration, but access still depends on user permission."}]);

page("24 • Platform admin","Platform dashboard","Monitor businesses, subscriptions, and platform health.",{title:"Platform owner dashboard",labels:["Businesses","Active stores","Trial businesses","Expired subscriptions","Revenue","Plan settings","Notices"],caption:"Only Super Admin accounts can use the platform administration area."},[
 {title:"Sign in as Super Admin",body:"Super Admin accounts are routed to the platform area rather than the store dashboard."},
 {title:"Review platform totals",body:"Inspect total businesses, active/trial/expired counts, payment and subscription metrics, and notices."},
 {title:"Find a business",body:"Open the business registry or a metric page and review the store’s plan, status, and contact information."},
 {title:"Manage a business or plan",body:"Use the purpose-built business actions or plan controls available on the page. Confirm status and dates before saving."},
],[{title:"Control caveat",body:"Some buttons visible in the platform overview table are display-only in the current implementation. Use the dedicated business action controls when present."}]);

page("25 • Platform admin","Platform metrics and business reports","Inspect registration, usage, revenue, trial, and expiry measures.",{title:"Platform metrics",labels:["Metric selector","Business list","Plan/status","Date window","Totals","Business actions"],caption:"Metric pages are restricted to the Super Admin role."},[
 {title:"Choose a metric",body:"Open Platform and select a metric such as registrations, active businesses, trials, expired subscriptions, users, transactions, sales, or revenue."},
 {title:"Review the table",body:"Read the metric summary and business-level rows. Apply available filters where provided."},
 {title:"Open business actions",body:"On metrics that expose them, use business controls to inspect or manage a specific store. Certain credential operations are limited to owner accounts."},
 {title:"Open platform reports",body:"Use Platform Reports for cross-business subscription, usage, payment, and sales summaries."},
]);

page("26 • Platform admin","Support inbox and system staff","Respond to store support and manage platform-only accounts.",{title:"Platform support and staff",labels:["Support inbox","Ticket details","Reply","Status","System Staff","Create account","Suspend/enable"],caption:"Platform support is separate from a store’s own Help & Support ticket list."},[
 {title:"Open platform support",body:"Choose the platform Support route. Select a ticket to read messages and business context."},
 {title:"Reply and update status",body:"Respond to the store and set the appropriate ticket status, such as in progress, resolved, or closed."},
 {title:"Manage system staff",body:"Open System Staff to create a platform-only account or update an existing account’s password/status."},
 {title:"Protect privileged access",body:"Assign platform credentials only to trusted staff and suspend accounts promptly when access is no longer needed."},
]);

page("27 • Plans","Plan comparison and feature access","Understand plan limits before choosing or upgrading.",{title:"Plan feature overview",labels:["Trial • 14 days","Starter • 1 staff","Premium • up to 3","Enterprise • unlimited","Feature checklist","Upgrade"],caption:"The registration trial starts on the selected paid package; the full-feature Trial package is a separate package configuration."},[
 {title:"Starter",body:"Configured for one staff account, core POS/products/sales, one-month reporting, and no customer/supplier/returns or barcode scanning features."},
 {title:"Premium",body:"Configured for up to three staff, customer/supplier management, returns, POS scanning, and unlimited reports. No camera scanning outside POS and no Offline POS."},
 {title:"Enterprise",body:"Configured for unlimited staff and broader feature availability, including camera scanning throughout the product workflows and Offline POS."},
 {title:"Trial period",body:"Self-registration grants 14 days of trial status on the selected Starter, Premium, or Enterprise plan. Trial access uses that package’s limits."},
],[{title:"Access enforcement",body:"The app checks plan restrictions on pages and APIs. Restricted feature pages show an upgrade notice; direct API access is also blocked."}]);

page("28 • Troubleshooting","Common issues and quick checks","Use these checks before submitting a support ticket.",{title:"Troubleshooting checklist",labels:["Sign-in","Subscription","Permissions","Barcode","Import errors","Payment status"],caption:"Do not repeat a payment or import until you know whether the first attempt succeeded."},[
 {title:"Cannot sign in",body:"Confirm identifier spelling and password. Try the recovery flow or ask the administrator to check account status."},
 {title:"Page says access denied",body:"Check role permissions and current subscription. Some modules also require a plan that includes the feature."},
 {title:"Import reports skipped rows",body:"Read each row number and issue. Check that the first row contains recognized headers and that product name, cost, selling price, and opening quantity are present."},
 {title:"Barcode lookup fails",body:"Verify the barcode is attached to the right product, the product is active, and the plan/role permits scanning and product lookup."},
 {title:"Payment appears uncertain",body:"Check the sales list/status and payment provider response before retrying. Contact support with receipt/reference details."},
 {title:"Need help",body:"Submit a support ticket with steps, expected/actual result, store, role, approximate time, and a screenshot that does not expose passwords or sensitive payment details."},
]);

// Add the directory/role reference and final page.
header("Reference","Page directory and role guide","Use this index to find the page associated with your task.");
const directory=[
 ["Overview","Dashboard"],["Sell","Make a Sale; Held Sales"],["Catalogue","Products; Import; Customers"],["Stock","Inventory; Expiry/Batches"],["Purchasing","Suppliers; Purchase Orders"],["Checkout follow-up","Sales; Returns"],["Workforce","Employees; Shifts"],["Analysis","Reports; Audit Logs"],["Configuration","Settings; Profile; Subscription"],["Support","Help & Support"],["Platform admin","Platform Dashboard; Metrics; Reports; Support; System Staff"]
];
let dy=doc.y;
directory.forEach((row,i)=>{if(i%2===0)doc.rect(LEFT,dy-3,CONTENT_W,25).fill(C.pale);text(row[0],LEFT+8,dy+3,{size:8,font:"Helvetica-Bold",width:142});text(row[1],LEFT+155,dy+3,{size:8,color:C.muted,width:335});dy+=25;});
doc.y=dy+20;
callout("Roles at a glance","Administrator: broad store control. Manager: broad operations without platform administration. Supervisor: narrower operational permissions. Cashier: POS, own sales, shifts, support. Stock Keeper: products/stock/purchasing workflows. Accountant: sales, returns view, reports, shifts and audit. Super Admin: platform registry, platform reports, platform support, and system staff.");
callout("Limits vary","Actual links/actions depend on role permissions, per-user permission overrides, subscription plan, and active subscription status. If a control shown in this guide is absent, ask an administrator to verify access.","warning");
text("End of manual",LEFT,doc.y+14,{size:9,font:"Helvetica-Bold",color:C.green});

footer();
doc.end();
await new Promise((resolve,reject)=>{stream.on("finish",resolve);stream.on("error",reject);});
console.log(`Created ${OUTPUT} (${fs.statSync(OUTPUT).size} bytes)`);
