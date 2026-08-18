
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json({limit:"5mb"}));

const PORT = process.env.PORT || 8787;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "orders.json");
fs.mkdirSync(DATA_DIR, {recursive:true});
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({orders:[]}, null, 2));

function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); }
function writeDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }

app.get("/api/health", (req,res)=>res.json({ok:true, service:"Smit Legal API"}));

app.get("/api/orders/:id", (req,res)=>{
  const db=readDB();
  const order=db.orders.find(x=>x.orderId===req.params.id);
  if(!order) return res.status(404).json({error:"Order not found"});
  res.json(order);
});

app.post("/api/orders", (req,res)=>{
  const body=req.body||{};
  const orderId="SMIT-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
  const order={
    orderId,
    createdAt:new Date().toISOString(),
    customer:body.customer||{},
    service:body.service||"",
    subService:body.subService||"",
    amount:Number(body.amount||0),
    documents:body.documents||[],
    payment:{status:"pending",reference:"",verifiedAt:null},
    processStatus:"Received",
    trackingId:"",
    invoiceNo:"INV-"+Date.now(),
  };
  const db=readDB(); db.orders.push(order); writeDB(db);
  res.status(201).json(order);
});

app.patch("/api/orders/:id/payment",(req,res)=>{
  const db=readDB();
  const order=db.orders.find(x=>x.orderId===req.params.id);
  if(!order) return res.status(404).json({error:"Order not found"});
  order.payment.reference=req.body.reference||"";
  order.payment.status=req.body.status==="verified" ? "verified" : "submitted";
  order.payment.verifiedAt=order.payment.status==="verified"?new Date().toISOString():null;
  writeDB(db); res.json(order);
});

app.patch("/api/orders/:id/status",(req,res)=>{
  const db=readDB();
  const order=db.orders.find(x=>x.orderId===req.params.id);
  if(!order) return res.status(404).json({error:"Order not found"});
  order.processStatus=req.body.processStatus||order.processStatus;
  order.trackingId=req.body.trackingId||order.trackingId;
  writeDB(db); res.json(order);
});

app.use(express.static(path.join(__dirname,"..")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"..","index.html")));

app.listen(PORT,()=>console.log(`Smit Legal API running on ${PORT}`));
