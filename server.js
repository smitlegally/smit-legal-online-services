const express=require('express');
const fs=require('fs');
const path=require('path');
const cron=require('node-cron');
const nodemailer=require('nodemailer');
const axios=require('axios');
const multer=require('multer');
const ExcelJS=require('exceljs');
const app=express();
app.use(express.json({limit:'10mb'}));
app.use(express.static(__dirname));
const PORT=process.env.PORT||10000;
const DATA=path.join(__dirname,'server-data');
const ORDERS=path.join(DATA,'orders.json');
const FILES=path.join(DATA,'files');
const REPORTS=path.join(DATA,'reports');
for(const d of [DATA,FILES,REPORTS,path.join(FILES,'pending'),path.join(FILES,'completed')])fs.mkdirSync(d,{recursive:true});
if(!fs.existsSync(ORDERS))fs.writeFileSync(ORDERS,'[]');
function readOrders(){try{return JSON.parse(fs.readFileSync(ORDERS,'utf8')||'[]')}catch{return[]}}
function writeOrders(x){fs.writeFileSync(ORDERS,JSON.stringify(Array.isArray(x)?x:[],null,2))}
function ist(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function num(v){return Number(v||0)}
function report(date){const all=readOrders().filter(o=>ist(new Date(o.paymentConfirmedAt||o.paidSubmittedAt||o.createdAt||0))===date);const paid=all.filter(o=>o.paymentStatus==='Payment Confirmed');const gov=paid.reduce((a,o)=>a+num(o.governmentFee),0),income=paid.reduce((a,o)=>a+num(o.serviceCharge),0),total=paid.reduce((a,o)=>a+num(o.total),0);return{date,all,paid,gov,income,total,pending:all.length-paid.length}}
async function makeXlsx(date){const r=report(date),wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Daily Sales');ws.addRow(['SMIT Legal & Online Services']);ws.addRow(['Daily Sales Report',date]);ws.addRow([]);ws.addRow(['Order ID','Customer','Service','Sub-service','Sub-option','Payment','Government Charges','Smit Service Charges','Total','Status','Transaction ID','Invoice']);r.all.forEach(o=>ws.addRow([o.id,o.name,o.service,o.subService,o.subOption,o.paymentStatus,num(o.governmentFee),num(o.serviceCharge),num(o.total),o.status,o.transactionId,o.invoiceNo]));ws.addRow([]);ws.addRow(['SUMMARY']);ws.addRow(['Paid Orders',r.paid.length]);ws.addRow(['Government Charges',r.gov]);ws.addRow(['Smit Exact Income',r.income]);ws.addRow(['Total Received',r.total]);ws.addRow(['Pending Orders',r.pending]);ws.columns.forEach(c=>c.width=Math.min(32,Math.max(14,(c.header||'').length+4)));const file=path.join(REPORTS,`SMIT-Daily-Sales-${date}.xlsx`);await wb.xlsx.writeFile(file);return{r,file}}
function transporter(){if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return null;return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}})}
async function deliver(date){const {r,file}=await makeXlsx(date);const out={date,file,email:'not configured',whatsapp:'not configured'};const t=transporter();if(t){try{await t.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:process.env.REPORT_EMAIL||'smitlegally@gmail.com',subject:`SMIT Daily Sales — ${date}`,text:`Paid: ${r.paid.length}\nGovernment Charges: ₹${r.gov}\nSmit Income: ₹${r.income}\nTotal Received: ₹${r.total}`,attachments:[{filename:path.basename(file),path:file}]});out.email='sent'}catch(e){out.email='failed: '+e.message}}
const token=process.env.WHATSAPP_ACCESS_TOKEN,pid=process.env.WHATSAPP_PHONE_NUMBER_ID,to=(process.env.REPORT_WHATSAPP||'').replace(/\D/g,'');if(token&&pid&&to){try{const graph=`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||'v23.0'}`;const media=await axios.post(`${graph}/${pid}/media`,fs.createReadStream(file),{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},params:{messaging_product:'whatsapp',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});await axios.post(`${graph}/${pid}/messages`,{messaging_product:'whatsapp',to,type:'document',document:{id:media.data.id,filename:path.basename(file),caption:`SMIT Daily Sales — ${date}\nSmit Income: ₹${r.income}\nTotal: ₹${r.total}`}}, {headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});out.whatsapp='sent'}catch(e){out.whatsapp='failed: '+e.message}}return out}
const upload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,path.join(FILES,'pending')),filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(file.originalname))}),limits:{fileSize:25*1024*1024}});
const metaFile=path.join(DATA,'files.json');if(!fs.existsSync(metaFile))fs.writeFileSync(metaFile,'[]');function filesMeta(){try{return JSON.parse(fs.readFileSync(metaFile,'utf8')||'[]')}catch{return[]}}function saveMeta(x){fs.writeFileSync(metaFile,JSON.stringify(x,null,2))}
app.get('/api/health',(q,s)=>s.json({ok:true,time:new Date().toISOString(),timezone:'Asia/Kolkata'}));
app.get('/api/orders',(q,s)=>s.json({orders:readOrders()}));
app.post('/api/orders',(q,s)=>{if(!Array.isArray(q.body.orders))return s.status(400).json({error:'orders must be an array'});writeOrders(q.body.orders);s.json({ok:true,count:q.body.orders.length})});
app.get('/api/daily-report.xlsx',async(q,s)=>{try{const d=/^\d{4}-\d{2}-\d{2}$/.test(q.query.date||'')?q.query.date:ist();const {file}=await makeXlsx(d);s.download(file,path.basename(file))}catch(e){s.status(500).json({error:e.message})}});
app.post('/api/daily-report/generate',async(q,s)=>{try{s.json({ok:true,...await deliver(q.body?.date||ist())})}catch(e){s.status(500).json({ok:false,error:e.message})}});
app.post('/api/files/upload',upload.single('file'),(q,s)=>{if(!q.file)return s.status(400).json({error:'file missing'});const arr=filesMeta();const m={id:q.file.filename,originalName:q.file.originalname,phone:q.body.phone||'',orderId:q.body.orderId||'',status:'pending',uploadedAt:new Date().toISOString(),path:q.file.path,url:'/files/pending/'+encodeURIComponent(q.file.filename)};arr.push(m);saveMeta(arr);s.json({ok:true,file:m})});
app.use('/files/pending',express.static(path.join(FILES,'pending')));app.use('/files/completed',express.static(path.join(FILES,'completed')));
app.get('/api/files',(q,s)=>{const status=q.query.status||'pending',date=q.query.date||'today',term=(q.query.q||'').toLowerCase();let a=filesMeta().filter(x=>x.status===status);if(date==='today'){const t=ist();a=a.filter(x=>ist(new Date(x.uploadedAt))===t)}if(term)a=a.filter(x=>[x.phone,x.orderId,x.originalName].join(' ').toLowerCase().includes(term));s.json({files:a.sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt))})});
app.post('/api/files/:id/complete',(q,s)=>{const a=filesMeta(),i=a.findIndex(x=>x.id===q.params.id);if(i<0)return s.status(404).json({error:'file not found'});const x=a[i],src=path.join(FILES,'pending',x.id),dst=path.join(FILES,'completed',x.id);if(fs.existsSync(src))fs.renameSync(src,dst);x.status='completed';x.completedAt=new Date().toISOString();x.url='/files/completed/'+encodeURIComponent(x.id);saveMeta(a);s.json({ok:true,file:x})});
app.post('/api/files/:id/update',upload.single('file'),(q,s)=>{if(!q.file)return s.status(400).json({error:'updated file missing'});const a=filesMeta(),i=a.findIndex(x=>x.id===q.params.id);if(i<0)return s.status(404).json({error:'file not found'});const old=a[i];const completedName=Date.now()+'-updated-'+Math.random().toString(36).slice(2)+path.extname(q.file.originalname);const dst=path.join(FILES,'completed',completedName);fs.renameSync(q.file.path,dst);old.status='completed';old.completedAt=new Date().toISOString();old.updatedName=q.file.originalname;old.updatedId=completedName;old.url='/files/completed/'+encodeURIComponent(completedName);old.updatedUrl=old.url;saveMeta(a);s.json({ok:true,file:old})});
const SCHEDULE=path.join(DATA,'report-schedule.json');
function readSchedule(){try{return JSON.parse(fs.readFileSync(SCHEDULE,'utf8'))}catch{return{enabled:true,hour:22,minute:0,lastRun:null,lastResult:null}}}
function writeSchedule(x){fs.writeFileSync(SCHEDULE,JSON.stringify(x,null,2))}
if(!fs.existsSync(SCHEDULE))writeSchedule({enabled:true,hour:22,minute:0,lastRun:null,lastResult:null});
let reportJob=null;
function scheduleReport(){
  if(reportJob){reportJob.stop();reportJob=null}
  const cfg=readSchedule();
  if(process.env.DISABLE_DAILY_CRON==='true'||cfg.enabled===false)return;
  const hour=Math.min(23,Math.max(0,Number(cfg.hour)||0)), minute=Math.min(59,Math.max(0,Number(cfg.minute)||0));
  reportJob=cron.schedule(`${minute} ${hour} * * *`,async()=>{
    const runAt=new Date().toISOString();
    try{const result=await deliver(ist());const c=readSchedule();c.lastRun=runAt;c.lastResult=result;writeSchedule(c);console.log('Scheduled daily delivery',result)}catch(e){const c=readSchedule();c.lastRun=runAt;c.lastResult={error:e.message,email:'failed',whatsapp:'failed'};writeSchedule(c);console.error(e)}} ,{timezone:'Asia/Kolkata'});
}
app.get('/api/report-schedule',(q,s)=>{const c=readSchedule();s.json({ok:true,...c,nextSchedule:`${String(c.hour).padStart(2,'0')}:${String(c.minute).padStart(2,'0')}`})});
app.post('/api/report-schedule',(q,s)=>{const hour=Number(q.body?.hour),minute=Number(q.body?.minute);if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)return s.status(400).json({ok:false,error:'Invalid time'});const c={...readSchedule(),enabled:q.body?.enabled!==false,hour,minute};writeSchedule(c);scheduleReport();s.json({ok:true,...c,nextSchedule:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`})});
app.post('/api/daily-report/test',async(q,s)=>{try{const result=await deliver(q.body?.date||ist());const c=readSchedule();c.lastRun=new Date().toISOString();c.lastResult=result;writeSchedule(c);s.json({ok:true,...result})}catch(e){s.status(500).json({ok:false,error:e.message})}});
scheduleReport();
app.listen(PORT,()=>{const c=readSchedule();console.log(`SMIT master server on ${PORT}; report schedule ${String(c.hour).padStart(2,'0')}:${String(c.minute).padStart(2,'0')} IST`)});
