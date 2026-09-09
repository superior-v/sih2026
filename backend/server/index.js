// server/index.js
// -----------------------------------------------
// Legal Metrology backend: product scraping + OCR + ESP32 + Barcode
// Providers: Tesseract | Google Vision | Gemini | Hybrid
// Features: ESP32-CAM integration | Barcode scanning | Product lookup | Live Crawling
// -----------------------------------------------

/* ===== 0) ENV FIRST! ===== */
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env, then fallback to repo root .env (if any)
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: false });

/* ===== 1) Imports ===== */
import express from "express";
import cors from "cors";
import * as cheerio from "cheerio";
import { z } from "zod";
import axios from 'axios';
import { chromium } from "playwright";
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { GoogleGenerativeAI } from "@google/generative-ai";
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { evaluateCompliance, rulesConfig } from "./complianceEngine.js";
import PDFDocument from 'pdfkit';

const bcrypt = bcryptjs;

/* ===== 2) App Setup ===== */
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
const upload = multer(); // in-memory uploads
const PORT = process.env.PORT || 3001;

// ==================== ADD THIS AUTHENTICATION CODE ====================

// In-memory user storage
const users = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    password: bcrypt.hashSync('demo123', 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Regular User',
    email: 'user@example.com',
    password: bcrypt.hashSync('demo123', 10),
    role: 'user',
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    searchCount: 25
  }
];

const searches = [];
const domains = [
  {
    id: '1',
    name: 'Amazon India',
    url: 'https://www.amazon.in',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-min-32-chars';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// LOGIN ENDPOINT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('Login attempt:', { email, role });

    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== role) {
      return res.status(403).json({ error: 'Access denied for this portal' });
    }

    user.lastActive = new Date().toISOString();

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    console.log('Login successful for:', email);
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ADMIN ENDPOINTS
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const usersList = users.map(({ password, ...user }) => ({
    ...user,
    searchCount: user.searchCount || 0
  }));
  res.json({ users: usersList });
});

app.get('/api/admin/searches', authenticateToken, requireAdmin, (req, res) => {
  res.json({ searches });
});

app.get('/api/admin/domains', authenticateToken, requireAdmin, (req, res) => {
  res.json({ domains });
});

app.post('/api/admin/domains', authenticateToken, requireAdmin, (req, res) => {
  const { name, url, status } = req.body;
  const newDomain = {
    id: String(domains.length + 1),
    name,
    url,
    status: status || 'active',
    createdAt: new Date().toISOString()
  };
  domains.push(newDomain);
  res.status(201).json({ domain: newDomain });
});

app.put('/api/admin/domains/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, url, status } = req.body;
  const domain = domains.find(d => d.id === id);
  if (!domain) {
    return res.status(404).json({ error: 'Domain not found' });
  }
  if (name) domain.name = name;
  if (url) domain.url = url;
  if (status) domain.status = status;
  res.json({ domain });
});

app.delete('/api/admin/domains/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = domains.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Domain not found' });
  }
  domains.splice(index, 1);
  res.json({ message: 'Domain deleted successfully' });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.json({ message: 'User deleted successfully' });
});

// ==================== END AUTHENTICATION CODE ====================

/* ===== 3) Config ===== */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-3.7-flash",
  "gemini-1.5-pro",
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const OCR_PROVIDERS = (process.env.OCR_PROVIDERS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);

// ESP32 Configuration
const ESP32_BASE_URL = process.env.ESP32_BASE_URL || "http://192.168.1.100";
const ESP32_ENDPOINTS = {
  capture: "/capture",
  stream: "/stream",
  status: "/status"
};

// Barcode API Configuration
const BARCODE_API_BASE = "https://api.upcitemdb.com/prod/trial/lookup";

// Safe/optional Vision client init (won't crash if missing)
let visionClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    visionClient = new ImageAnnotatorClient(); // will still error at call time if billing is disabled
    console.log("[vision] client initialized");
  } catch (e) {
    console.warn("[vision] init failed (will be ignored):", e?.message || e);
  }
} else {
  console.log("[vision] GOOGLE_APPLICATION_CREDENTIALS not set; Vision disabled");
}

// Optional Gemini init
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;
if (genAI) console.log("[gemini] key loaded");

/* ===== 4) Helpers ===== */
const ALLOW_RE = [
  /(\.|^)amazon\.in$/i,
  /(\.|^)flipkart\.com$/i,
  /(\.|^)myntra\.com$/i,
  /(\.|^)bigbasket\.com$/i,
  /(\.|^)grofers\.com$/i,
  /(\.|^)1mg\.com$/i,
  /(\.|^)nykaa\.com$/i,
  // Add more as needed
];
const isAllowedHost = (host) => ALLOW_RE.some((re) => re.test(host));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": UA,
  "Accept-Language": "en-IN,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Upgrade-Insecure-Requests": "1",
};

const fetchWithTimeout = async (url, opts = {}, ms = 12000) => {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(id);
  }
};

const normalizePrice = (val) => {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const n = Number(String(val).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const platformFromHost = (host) =>
  host.includes("amazon")
    ? "Amazon"
    : host.includes("flipkart")
      ? "Flipkart"
      : host.includes("myntra")
        ? "Myntra"
        : host.includes("bigbasket")
          ? "BigBasket"
          : host.includes("nykaa")
            ? "Nykaa"
            : host.includes("1mg")
              ? "1mg"
              : "Unknown";

const minimalOk = (d) => !!(d?.productName || d?.brand || d?.price || d?.image);

const avgConfidence = (words) => {
  if (!words?.length) return 0;
  const sum = words.reduce((a, w) => a + (w.confidence || 0), 0);
  return Math.round((sum / words.length) * 10) / 10;
};

const avgConfidenceVision = (annotation) => {
  try {
    const pages = annotation?.fullTextAnnotation?.pages || [];
    const vals = [];
    for (const p of pages)
      for (const b of p.blocks || [])
        for (const g of b.paragraphs || [])
          for (const w of g.words || [])
            for (const s of w.symbols || [])
              if (typeof s.confidence === "number") vals.push(s.confidence * 100);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  } catch {
    return 0;
  }
};

function withTimeout(promise, ms, label = "Task") {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(id); resolve(v); })
      .catch((e) => { clearTimeout(id); reject(e); });
  });
}

const toMime = (fmt) => {
  switch ((fmt || "").toLowerCase()) {
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "tiff":
      return "image/tiff";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
};

// New helper functions for barcode functionality
async function decodeBarcode(imageBuffer) {
  try {
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    return code ? code.data : null;
  } catch (error) {
    console.error('Barcode decode error:', error);
    return null;
  }
}

async function lookupBarcodeInfo(barcode) {
  console.log('=== BARCODE LOOKUP START ===');
  console.log('Looking up barcode:', barcode);
  console.log('API URL:', BARCODE_API_BASE);
  try {
    const response = await axios.get(BARCODE_API_BASE, {
      params: { upc: barcode },
      timeout: 10000
      // No headers needed for free tier
    });

    console.log('✅ API Success - Status:', response.status);
    console.log('✅ API Response:', response.data);

    if (response.data.code === "OK" && response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      return {
        barcode,
        productName: item.title || null,
        brand: item.brand || null,
        category: item.category || null,
        description: item.description || null,
        image: item.images && item.images.length > 0 ? item.images[0] : null,
        upc: item.upc || null,
        ean: item.ean || null,
        found: true
      };
    }
    return { barcode, found: false };
  } catch (error) {
    console.error('Barcode lookup error:', error);

    console.error('❌ LOOKUP ERROR:', error.message);
    console.error('❌ Error details:', error.response?.data || error);

    return { barcode, found: false, error: error.message };
  }
}

/* ===== 5) Legal Metrology Field Parser & Validator ===== */
function parseFields(fullText) {
  const raw = (fullText || "").replace(/\r\n/g, "\n");
  const text = raw.replace(/[ \t]+/g, " ");
  const upper = text.toUpperCase();

  // MRP & Tax Disclaimer (e.g. M.R.P. ₹ : 299.00 (Incl. of all taxes), MRP: 299)
  const mMrp =
    upper.match(/(?:MRP|M\.R\.P\.?|MAX(?:IMUM)?\s*RETAIL\s*PRICE|PRICE|RS\.?|INR|₹)\s*[:\.\-]?\s*([₹RRs\.]?\s?\d{1,5}(?:[ ,]?\d{3})*(?:\.\d{1,2})?)/i) ||
    upper.match(/([₹]\s?\d{1,5}(?:\.\d{1,2})?)/);
  const hasTaxDisclaimer = /(?:INCL(?:USIVE)?\.?\s*(?:OF)?\s*ALL\s*TAXES|INCL\.?\s*OF\s*ALL\s*TAXES)/i.test(upper);
  const mrpVal = mMrp ? parseFloat(mMrp[1].replace(/[^0-9.]/g, "")) : null;
  const isMrpCompliant = Boolean(mMrp && mrpVal && mrpVal > 0 && hasTaxDisclaimer);

  // Net Quantity / Net Content (e.g. Net Content (When Packed) : 100 ml, 100ml, 500 g)
  const mNet =
    upper.match(/(?:NET\s*(?:CONTENT|QUANTITY|QTY|WT|WEIGHT|VOL|VOLUME)|NET)\s*(?:\([^\)]*\))?\s*[:\.\-]?\s*(\d+(?:\.\d+)?\s*(?:ML|L|LTR|LITRES?|G|GM|GRAMS?|KG|KGS|TABLETS|CAPSULES|PIECES|PCS|COUNT|N\b|U\b))/i) ||
    upper.match(/(\d+(?:\.\d+)?\s*(?:ML|LTR|LITRES?|GM|GRAMS?|KG|KGS)\b)/i);
  
  let netQtyVal = null;
  let netQtyUnit = null;
  let isNetQtyCompliant = false;
  let netQtyReason = "Net quantity is missing.";

  if (mNet && mNet[1]) {
    const rawNet = mNet[1].trim();
    const qtyMatch = rawNet.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
    if (qtyMatch) {
      netQtyVal = parseFloat(qtyMatch[1]);
      netQtyUnit = qtyMatch[2].toLowerCase();
      const validSI = ["g", "kg", "ml", "l", "ltr", "m", "cm", "mm", "number", "unit", "piece", "pcs", "n", "u"];
      if (validSI.includes(netQtyUnit)) {
        isNetQtyCompliant = true;
        netQtyReason = "Declared with valid SI unit.";
      } else {
        netQtyReason = `Unit '${netQtyUnit}' is not a recognised SI unit under Rule 11/13.`;
      }
    }
  }

  // Unit Sale Price (USP) (e.g. (RS. 2.99/ML), Rs 2.99 / ml)
  const mUsp =
    upper.match(/(?:USP|UNIT\s*SALE\s*PRICE|\(RS\.?|\(INR)\s*[:\.\-]?\s*([₹Rs\.]?\s?\d+(?:\.\d+)?\s*\/\s*(?:ML|L|G|GM|KG|PCS|PIECE|UNIT|M|CM))/i);
  let uspVal = null;
  let isUspCompliant = false;
  let uspReason = "USP not detected.";

  if (mUsp && mUsp[1]) {
    const uspMatch = mUsp[1].match(/(\d+(?:\.\d+)?)/);
    if (uspMatch) {
      uspVal = parseFloat(uspMatch[1]);
      if (mrpVal && netQtyVal && netQtyVal > 0) {
        const expectedPerUnit = +(mrpVal / netQtyVal).toFixed(2);
        if (Math.abs(expectedPerUnit - uspVal) <= 0.05 || Math.abs((mrpVal / (netQtyVal / 1000)) - uspVal) <= 0.05) {
          isUspCompliant = true;
          uspReason = `USP ₹${uspVal} correctly matches MRP (₹${mrpVal}) / Net Qty.`;
        } else {
          isUspCompliant = false;
          uspReason = `Declared USP (₹${uspVal}) does not match calculated price (₹${expectedPerUnit}).`;
        }
      } else {
        isUspCompliant = true;
        uspReason = "USP format detected.";
      }
    }
  }

  // Batch No (e.g. Batch No. : AD22124, LOT NO 123)
  const mBatch =
    upper.match(/(?:BATCH\s*(?:NO|NUMBER|\.)|LOT\s*(?:NO|NUMBER|\.)|B\.\s*NO|LOT|BATCH)\s*[:\.\-]?\s*([A-Z0-9\/-]{3,20})/i) ||
    upper.match(/\b([A-Z]{1,3}\d{4,8})\b/);

  // Mfg Date (e.g. Mfg. Date : JUL. 22, 07/2022)
  const mMfg =
    upper.match(/(?:MFG\.?\s*DATE|DATE\s*OF\s*MFG|MFD\.?|MANUFACTURED|MFG)\s*[:\.\-]?\s*([A-Z]{3,}\.?\s*\d{2,4}|\d{1,2}[\/\.-]\d{2,4})/i);

  // Best Before / Expiry / Use Before (e.g. Use Before : JUL. 24, BEST BEFORE 24 MONTHS)
  const mBest =
    upper.match(/(?:USE\s*BEFORE|EXPIRY\s*DATE|EXP\.?\s*DATE|BEST\s*BEFORE|EXPIRY|EXP)\s*[:\.\-]?\s*([A-Z0-9\/\.\s-]{3,25})/i) ||
    upper.match(/BEST\s+BEFORE[^A-Z0-9]*([0-9]{1,2}\s*(?:MONTH|MONTHS|YEAR|YEARS)|\d+\s*DAYS)/i);

  // Country of Origin
  const mOrigin = upper.match(/COUNTRY\s+OF\s+ORIGIN\s*[:\.\-]?\s*([A-Z]+)/i) ||
    (upper.includes("MADE IN INDIA") ? { 1: "INDIA" } : null);

  // Manufacturer / Packer / Importer (Rule 6(1)(a) requires complete name & address with PIN code)
  const mManu = upper.match(/(?:MFD\.?\s*BY|MANUFACTURER|MANUFACTURED\s*BY|MFRD\.?\s*BY|PRODUCED\s*BY|PACKED\s*BY|MARKETED\s*BY|M\.:)\s*[:\.\-]?\s*([A-Z0-9&\-\.,\/ ]{4,})/i);
  let manuText = mManu?.[1]?.trim() || null;
  let isManuCompliant = false;
  let manuReason = "Manufacturer/Packer name & address not detected.";

  if (manuText) {
    // Check if it's only a license number like HIM/COS/... or M.L. No
    const isOnlyLicense = /^[A-Z0-9\/-]{5,20}$/i.test(manuText) || /^(HIM|COS|MFG|LIC|ML|FDA|DL)[\/]/i.test(manuText);
    const hasPostalOrCity = /PIN|PLOT|SECTOR|STREET|ROAD|NAGAR|ROAD|MIDC|ESTATE|DIST|MUMBAI|DELHI|PUNE|BANGALORE|CHENNAI|HYDERABAD|KOLKATA|SOLAN|BADDI|GUJARAT|MAHARASHTRA|HARYANA|\b\d{6}\b/i.test(upper);

    if (isOnlyLicense && !hasPostalOrCity) {
      isManuCompliant = false;
      manuReason = "Found manufacturing license number only. Rule 6(1)(a) requires complete postal address of manufacturer with PIN code.";
    } else if (manuText.length >= 10 || hasPostalOrCity) {
      isManuCompliant = true;
      manuReason = "Manufacturer details declared.";
    } else {
      isManuCompliant = false;
      manuReason = "Address appears incomplete (requires city/state & PIN code).";
    }
  }

  // Consumer care
  const mCare = upper.match(/(?:CONSUMER\s*CARE|CUSTOMER\s*CARE|HELPLINE|TOLL\s*FREE|EMAIL)\s*[:\.\-]?\s*([0-9\-\+\s]{8,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const hasCareEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(upper);
  const hasCarePhone = /(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}|1800[\-\s]?\d{3}[\-\s]?\d{3,4}/.test(upper);
  const isCareCompliant = hasCareEmail || hasCarePhone;

  // Product Name / Generic Name
  // Filter out barcode/scanner instruction text like "SCAN WITH THE TRANSPARENCY APP"
  const mName = upper.match(/([A-Z][A-Z0-9 \-\+]{4,})\s*(?:HONEY|TEA|OIL|RICE|BISCUIT|MILK|JUICE|POWDER|CREAM|LOTION|SHAMPOO|GEL|SERUM|WASH|SOAP|TABLETS|SYRUP)?/);
  let prodName = mName?.[1]?.trim() || null;
  if (prodName && /TRANSPARENCY|SCAN\s+WITH|DOWNLOAD\s+APP|BARCODE|QR\s*CODE/i.test(prodName)) {
    prodName = null;
  }
  const isProdNameCompliant = Boolean(prodName && prodName.length >= 3);

  return {
    productName: {
      text: prodName,
      ruleRef: "Rule 6(1)(b)",
      confidence: isProdNameCompliant ? 90 : 0,
      compliant: isProdNameCompliant,
      notes: isProdNameCompliant ? "Generic/Common name identified." : "Generic name of commodity not found (Rule 6(1)(b)).",
    },
    netQuantity: {
      text: mNet?.[1]?.trim() || null,
      ruleRef: "Rule 6(1)(c) / Rule 11",
      confidence: isNetQtyCompliant ? 95 : (mNet ? 50 : 0),
      compliant: isNetQtyCompliant,
      notes: netQtyReason,
    },
    mrp: {
      text: mMrp?.[1]?.trim() || null,
      ruleRef: "Rule 6(1)(e)",
      confidence: isMrpCompliant ? 98 : (mMrp ? 55 : 0),
      compliant: isMrpCompliant,
      notes: isMrpCompliant
        ? "MRP declared with '(inclusive of all taxes)'"
        : (mMrp ? "MRP declared but missing mandatory '(inclusive of all taxes)' tax disclaimer (Rule 6(1)(e))." : "MRP is missing."),
    },
    unitSalePrice: {
      text: mUsp?.[1]?.trim() || null,
      ruleRef: "Rule 6(11)",
      confidence: isUspCompliant ? 95 : (mUsp ? 50 : 0),
      compliant: isUspCompliant,
      notes: uspReason,
    },
    batchNo: {
      text: mBatch?.[1]?.trim() || null,
      ruleRef: "Rule 6(1)(d)",
      confidence: mBatch ? 90 : 0,
      compliant: !!mBatch,
      notes: mBatch ? "Batch/Lot number identified." : "Batch number missing.",
    },
    mfgDate: {
      text: mMfg?.[1]?.trim() || null,
      ruleRef: "Rule 6(1)(d)",
      confidence: mMfg ? 90 : 0,
      compliant: !!mMfg,
      notes: mMfg ? "Month & Year of manufacture declared." : "Mfg date missing (Rule 6(1)(d)).",
    },
    bestBefore: {
      text: mBest?.[1]?.trim() || null,
      ruleRef: "Rule 6(1)(da)",
      confidence: mBest ? 90 : 0,
      compliant: !!mBest,
      notes: mBest ? "Use before / Expiry date declared." : "Expiry / Best Before date not detected.",
    },
    manufacturer: {
      text: manuText,
      ruleRef: "Rule 6(1)(a)",
      confidence: isManuCompliant ? 90 : (manuText ? 40 : 0),
      compliant: isManuCompliant,
      notes: manuReason,
    },
    countryOfOrigin: {
      text: mOrigin?.[1]?.trim() || null,
      ruleRef: "Rule 6(10) / Rule 6(1)(aa)",
      confidence: mOrigin ? 90 : 0,
      compliant: !!mOrigin,
      notes: mOrigin ? "Country of origin declared." : "Country of origin declaration not detected.",
    },
    consumerCare: {
      text: mCare?.[1]?.trim() || null,
      ruleRef: "Rule 6(2)",
      confidence: isCareCompliant ? 90 : 0,
      compliant: isCareCompliant,
      notes: isCareCompliant ? "Grievance redressal contact found." : "Consumer grievance redressal email/helpline missing (Rule 6(2)).",
    },
  };
}

/* ===== 6) Sandbox fixtures (unchanged) ===== */
const SANDBOX = {
  amazon: {
    B07WNS52H2: {
      productName:
        "NAKPRO Micronised Creatine Monohydrate 250g, Unflavoured (83 Servings)",
      brand: "NAKPRO",
      price: 499,
      currency: "INR",
      image: "https://via.placeholder.com/400x400.png?text=NAKPRO+Creatine",
      rating: 4.2,
      ratingCount: 2971,
    },
  },
  flipkart: {
    "example-sku-1": {
      productName: "Organic Honey – 500g",
      brand: "Forest Gold",
      price: 349,
      currency: "INR",
      image: "https://via.placeholder.com/400x400.png?text=Flipkart+Honey",
      rating: 4.1,
      ratingCount: 812,
    },
  },
  myntra: {
    "example-sku-2": {
      productName: "Organic Green Tea – 100g",
      brand: "Teawise",
      price: 249,
      currency: "INR",
      image: "https://via.placeholder.com/400x400.png?text=Myntra+Tea",
      rating: 4.4,
      ratingCount: 122,
    },
  },
};

function extractSandboxKey(u) {
  const host = u.hostname.toLowerCase();
  if (host.endsWith("amazon.in")) {
    let m = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
    if (m) return { vendor: "amazon", key: m[1].toUpperCase() };
    m = u.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (m) return { vendor: "amazon", key: m[1].toUpperCase() };
    const asin = u.searchParams.get("ASIN") || u.searchParams.get("asin");
    if (asin && /^[A-Z0-9]{10}$/i.test(asin)) return { vendor: "amazon", key: asin.toUpperCase() };
  }
  if (host.endsWith("flipkart.com")) return { vendor: "flipkart", key: "example-sku-1" };
  if (host.endsWith("myntra.com")) return { vendor: "myntra", key: "example-sku-2" };
  return null;
}

function sandboxLookup(u) {
  const info = extractSandboxKey(u);
  if (!info) return null;
  const item = SANDBOX[info.vendor]?.[info.key];
  if (!item) return null;
  return {
    platform: platformFromHost(u.hostname),
    url: u.href,
    productName: item.productName,
    brand: item.brand,
    price: item.price,
    currency: item.currency || "INR",
    image: item.image || null,
    rating: item.rating ?? null,
    ratingCount: item.ratingCount ?? null,
  };
}

/* ===== 7) HTML extraction (fast path) ===== */
function extractFromHtml(html, finalUrl) {
  const $ = cheerio.load(html);
  const host = new URL(finalUrl).hostname.toLowerCase();

  const t = (sel) => $(sel).first().text()?.trim() || null;
  const attr = (sel, a) => $(sel).first().attr(a) || null;
  const meta = (p) => $(`meta[property="${p}"]`).attr("content") || null;

  let productName = null,
    brand = null,
    price = null,
    currency = "INR",
    image = null,
    rating = null,
    ratingCount = null;

  const jsonld = $('script[type="application/ld+json"]')
    .toArray()
    .map((s) => {
      try { return JSON.parse($(s).text()); } catch { return null; }
    })
    .filter(Boolean)
    .flatMap((n) => (Array.isArray(n) ? n : [n]));

  const productNode =
    jsonld.find((n) => n?.["@type"] === "Product" || n?.["@type"]?.includes?.("Product")) || null;

  if (productNode) {
    productName ||= productNode.name || null;
    brand ||= typeof productNode.brand === "string" ? productNode.brand : productNode.brand?.name || null;
    image ||= Array.isArray(productNode.image) ? productNode.image[0] : productNode.image || null;
    const offers = Array.isArray(productNode.offers) ? productNode.offers[0] : productNode.offers;
    if (offers) { price ||= offers.price || null; currency = offers.priceCurrency || currency; }
    const agg = productNode.aggregateRating || null;
    if (agg) { rating = agg.ratingValue ?? rating; ratingCount = agg.ratingCount ?? agg.reviewCount ?? ratingCount; }
  }

  if (host.endsWith("amazon.in")) {
    productName ||= t("#productTitle") || t("span#title") || meta("og:title") || $("title").text().trim();
    if (productName && /: Amazon\.in/i.test(productName)) productName = productName.replace(/\s*: Amazon\.in.*$/i, "").trim();
    brand ||= t("#bylineInfo") || t("a#bylineInfo") || t("tr.po-brand td.a-span9 span") || t(".po-brand .a-span9 .a-size-base");
    price ||= t(".a-price .a-offscreen") || t("#priceblock_ourprice") || t("#priceblock_dealprice")
      || t(".apexPriceToPay .a-offscreen") || t("span.a-price-whole") || meta("product:price:amount");
    image ||= meta("og:image") || attr("#landingImage", "data-old-hires") || attr("#landingImage", "src") || attr("#imgTagWrapperId img", "src");
  } else if (host.endsWith("flipkart.com")) {
    productName ||= t("span.B_NuCI") || meta("og:title") || $("title").text().trim();
    brand ||= t("span.G6XhRU") || $("._2whKao").first().text();
    price ||= t("div._30jeq3._16Jk6d") || $("._25b18c ._30jeq3").first().text() || $("div._30jeq3").first().text() || meta("product:price:amount");
    image ||= meta("og:image") || attr("img._396cs4._2amPTt._3qGmMb", "src") || attr("img._396cs4", "src");
  } else if (host.endsWith("myntra.com")) {
    productName ||= [t("h1.pdp-title"), t("h1.pdp-name")].filter(Boolean).join(" ") || meta("og:title") || $("title").text().trim();
    brand ||= t("h1.pdp-title");
    price ||= t(".pdp-discounted-price") || t(".pdp-price") || $("span.pdp-price").first().text() || meta("product:price:amount");
    image ||= meta("og:image") || attr(".image-grid-container img, .image-grid img", "src");
  } else if (host.endsWith("nykaa.com")) {
    productName ||= t(".css-1gc4x7i") || t("h1.pdp-name") || meta("og:title") || $("title").text().trim();
    brand ||= t(".css-1gc4x7i .brand-name") || t(".brand") || $(".product-brand").text();
    price ||= t(".css-1e9zbzk") || t(".product-price") || meta("product:price:amount");
    image ||= meta("og:image") || attr(".product-image img", "src");
  } else if (host.endsWith("bigbasket.com")) {
    productName ||= t(".Details___StyledH") || t("h1") || meta("og:title") || $("title").text().trim();
    brand ||= t(".brand") || $(".manufacturer").text();
    price ||= t(".Label-sc-15v1nk5-0") || t(".price") || meta("product:price:amount");
    image ||= meta("og:image") || attr(".product-image img", "src");
  }

  return {
    platform: platformFromHost(host),
    url: finalUrl,
    productName,
    brand,
    price: normalizePrice(price),
    currency,
    image,
    rating: rating != null ? Number(rating) : null,
    ratingCount: ratingCount != null ? Number(ratingCount) : null,
  };
}

/* ===== 8) Enhanced Playwright fallback with platform-specific configs ===== */
async function extractWithBrowser(startUrl) {
  const browser = await chromium.launch({ headless: true });
  try {
    const host = new URL(startUrl).hostname.toLowerCase();

    // Platform-specific browser configurations
    let contextOptions;
    let waitCondition;
    let waitTime;

    if (host.includes('amazon')) {
      // Amazon configuration - works well with original settings
      contextOptions = {
        userAgent: UA,
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        viewport: { width: 1366, height: 900 },
      };
      waitCondition = "domcontentloaded";
      waitTime = 900;
    } else if (host.includes('flipkart') || host.includes('myntra')) {
      // Enhanced configuration for Flipkart/Myntra
      contextOptions = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        viewport: { width: 1366, height: 900 },
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        }
      };
      waitCondition = "networkidle";
      waitTime = Math.random() * 2000 + 1500; // Random delay 1.5-3.5s
    } else {
      // Default configuration for other platforms
      contextOptions = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        viewport: { width: 1366, height: 900 },
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      };
      waitCondition = "domcontentloaded";
      waitTime = 1000;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Navigate to the page
    await page.goto(startUrl, { waitUntil: waitCondition, timeout: 30000 });
    await page.waitForTimeout(waitTime);

    // Add some human-like behavior for non-Amazon sites
    if (!host.includes('amazon')) {
      await page.mouse.move(Math.random() * 100, Math.random() * 100);
      await page.waitForTimeout(500);
    }

    const finalUrl = page.url();
    const finalHost = new URL(finalUrl).hostname.toLowerCase();
    if (!isAllowedHost(finalHost)) throw new Error(`Final domain not allowed: ${finalHost}`);

    const prod = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of nodes) {
        try {
          const val = JSON.parse(s.textContent || "null");
          const arr = Array.isArray(val) ? val : [val];
          const p = arr.find(
            (n) => n && (n["@type"] === "Product" || (Array.isArray(n["@type"]) && n["@type"].includes("Product")))
          );
          if (p) return p;
        } catch { }
      }
      return null;
    });

    let productName = null, brand = null, price = null, image = null, rating = null, ratingCount = null, currency = "INR";
    if (prod) {
      productName = prod.name || null;
      brand = typeof prod.brand === "string" ? prod.brand : prod.brand?.name || null;
      image = Array.isArray(prod.image) ? prod.image[0] : prod.image || null;
      const offers = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
      if (offers) { price = offers.price || null; currency = offers.priceCurrency || currency; }
      if (prod.aggregateRating) {
        rating = prod.aggregateRating.ratingValue ?? null;
        ratingCount = prod.aggregateRating.ratingCount ?? prod.aggregateRating.reviewCount ?? null;
      }
    }

    if (finalHost.endsWith("amazon.in")) {
      productName ||= (await page.locator("#productTitle, span#title").first().textContent().catch(() => null))?.trim() || null;
      if (productName && /: Amazon\.in/i.test(productName))
        productName = productName.replace(/\s*: Amazon\.in.*$/i, "").trim();
      brand ||= (await page
        .locator("#bylineInfo, a#bylineInfo, tr.po-brand td.a-span9 span, .po-brand .a-span9 .a-size-base")
        .first().textContent().catch(() => null))?.trim() || null;
      const priceText = await page
        .locator(".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .apexPriceToPay .a-offscreen, span.a-price-whole")
        .first().textContent().catch(() => null);
      price ||= priceText?.trim() || null;
      image ||= await page.locator("#landingImage, #imgTagWrapperId img").first().getAttribute("src").catch(() => null);
    } else if (finalHost.endsWith("flipkart.com")) {
      productName ||= (await page.locator("span.B_NuCI, .B_NuCI").first().textContent().catch(() => null))?.trim() || null;
      brand ||= (await page.locator("span.G6XhRU, ._2whKao, .G6XhRU").first().textContent().catch(() => null))?.trim() || null;
      const priceText = await page
        .locator("div._30jeq3._16Jk6d, ._25b18c ._30jeq3, div._30jeq3, ._30jeq3")
        .first().textContent().catch(() => null);
      price ||= priceText?.trim() || null;
      image ||= await page.locator("img._396cs4._2amPTt._3qGmMb, img._396cs4, ._396cs4").first().getAttribute("src").catch(() => null);
    } else if (finalHost.endsWith("myntra.com")) {
      const t1 = await page.locator("h1.pdp-title, .pdp-title").first().textContent().catch(() => null);
      const t2 = await page.locator("h1.pdp-name, .pdp-name").first().textContent().catch(() => null);
      productName ||= [t1?.trim(), t2?.trim()].filter(Boolean).join(" ") || null;
      brand ||= t1?.trim() || null;
      const priceText = await page.locator(".pdp-discounted-price, .pdp-price, span.pdp-price").first().textContent().catch(() => null);
      price ||= priceText?.trim() || null;
      image ||= await page.locator(".image-grid-container img, .image-grid img").first().getAttribute("src").catch(() => null);
    } else if (finalHost.endsWith("nykaa.com")) {
      productName ||= (await page.locator(".css-1gc4x7i, h1.pdp-name, h1").first().textContent().catch(() => null))?.trim() || null;
      brand ||= (await page.locator(".brand-name, .brand, .product-brand").first().textContent().catch(() => null))?.trim() || null;
      const priceText = await page.locator(".css-1e9zbzk, .product-price, .price").first().textContent().catch(() => null);
      price ||= priceText?.trim() || null;
      image ||= await page.locator(".product-image img, img").first().getAttribute("src").catch(() => null);
    } else if (finalHost.endsWith("bigbasket.com")) {
      productName ||= (await page.locator(".Details___StyledH, h1").first().textContent().catch(() => null))?.trim() || null;
      brand ||= (await page.locator(".brand, .manufacturer").first().textContent().catch(() => null))?.trim() || null;
      const priceText = await page.locator(".Label-sc-15v1nk5-0, .price").first().textContent().catch(() => null);
      price ||= priceText?.trim() || null;
      image ||= await page.locator(".product-image img, img").first().getAttribute("src").catch(() => null);
    }

    return {
      platform: platformFromHost(finalHost),
      url: finalUrl,
      productName,
      brand,
      price: normalizePrice(price),
      currency,
      image,
      rating: rating != null ? Number(rating) : null,
      ratingCount: ratingCount != null ? Number(ratingCount) : null,
    };
  } finally {
    await browser.close().catch(() => { });
  }
}

/* ===== 9) Image proxy (for client OCR previews) ===== */
app.get("/api/proxy-image", async (req, res) => {
  try {
    const url = z.string().url().parse(req.query.url);
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).end();
    const ct = resp.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader("Content-Type", ct);
    res.send(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    res.status(500).json({ error: msg });
  }
});

/* ===== 10) OCR Image Preparation & Engines ===== */

// High quality auto-oriented RGB image for multimodal AI (Gemini / Google Vision)
async function prepareImageForAI(inputBuffer) {
  return await sharp(inputBuffer)
    .rotate() // auto-rotate based on EXIF
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
}

// Contrast-normalized and binarized image for Tesseract
async function prepareImageForTesseract(inputBuffer, fast = false) {
  const TARGET_W = fast ? 1600 : 2200;
  return await sharp(inputBuffer)
    .rotate() // auto-orient from EXIF
    .resize({ width: TARGET_W, withoutEnlargement: true, fit: "inside" })
    .grayscale()
    .normalise()
    .linear(1.4, -20) // Boost contrast between printed text and packaging background
    .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.5 })
    .png()
    .toBuffer();
}

async function runTesseract(buf, lang = "eng", fast = false) {
  const tessImg = await prepareImageForTesseract(buf, fast);
  const result = await Tesseract.recognize(tessImg, lang, {
    tessedit_pageseg_mode: 6, // Assume a uniform block of text
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;/-()#₹ '\"%+",
    preserve_interword_spaces: "1",
  });
  const text = (result?.data?.text || "").trim();
  const words = result?.data?.words || [];
  return { text, confidence: avgConfidence(words) };
}

async function runVision(buf) {
  if (!visionClient) {
    throw new Error("Google Vision isn't configured (GOOGLE_APPLICATION_CREDENTIALS not set).");
  }
  const aiImg = await prepareImageForAI(buf);
  try {
    const [result] = await visionClient.documentTextDetection({ image: { content: aiImg } });
    const full = result?.fullTextAnnotation?.text || "";
    return { text: (full || "").trim(), confidence: avgConfidenceVision(result) };
  } catch (e) {
    const msg = e?.message || String(e);
    if (/billing|permission_denied/i.test(msg)) {
      throw new Error("Google Vision requires billing to be enabled on your GCP project.");
    }
    throw e;
  }
}

async function runGeminiOCR(buf) {
  if (!genAI) throw new Error("Gemini API not configured (GEMINI_API_KEY)");
  const aiImg = await prepareImageForAI(buf);
  const meta = await sharp(aiImg).metadata();
  const mime = toMime(meta?.format) || "image/jpeg";

  const prompt = `You are a precision Optical Character Recognition (OCR) model specializing in retail packaged goods, cosmetics, pharmaceutical products, and legal metrology declarations.

Your task is to transcribe ALL text visible on this product packaging with exact fidelity.

Please make sure to transcribe:
1. Product & Brand names
2. Net Content / Quantity (e.g., "Net Content (When Packed) : 100 ml", "Net Qty : 50 g")
3. Stamped / Injected / Dot-matrix codes:
   - Batch No. / Lot No. (e.g. "Batch No. : AD22124")
   - Mfg. Date / Date of Manufacture (e.g. "Mfg. Date : JUL. 22")
   - Use Before / Expiry Date / Best Before (e.g. "Use Before : JUL. 24")
4. Pricing:
   - Maximum Retail Price (e.g. "M.R.P. ₹ : 299.00 (Incl. of all taxes)")
   - Unit Sale Price (e.g. "(RS. 2.99 / ML)")
5. Manufacturer / Packer / Marketer details & addresses (e.g. "M.: HIM/COS/16/227")
6. Consumer Care details (Email, Phone/Toll-Free, Address)
7. Country of origin, ingredients, and barcodes if readable.

RULES:
- Maintain line breaks and grouping.
- Keep label headers and their associated values on the same line (e.g., "Batch No. : AD22124").
- Do not hallucinate, omit, or add introductory/explanatory commentary.
- Return only the extracted plain text lines.`;

  let lastError = null;
  for (const modelName of GEMINI_FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent([
        { text: prompt },
        { inlineData: { data: aiImg.toString("base64"), mimeType: mime } },
      ]);
      const text = (await res.response.text())?.trim() || "";
      const cleaned = text.replace(/```[a-z]*\n?|```/gi, "").trim();
      return { text: cleaned, confidence: 95, modelUsed: modelName };
    } catch (err) {
      console.warn(`[gemini] Model ${modelName} encountered error (${err?.status || err?.message || err}). Trying fallback model...`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini models failed to process image");
}

async function runHybrid(buf) {
  // Try Vision first if available
  let visionSuccess = false;
  let base = { text: "", confidence: 0 };
  if (visionClient) {
    try {
      base = await runVision(buf);
      if (base.text && base.text.length > 10) {
        visionSuccess = true;
      }
    } catch (e) {
      console.warn("[runHybrid] Vision failed, falling back to Gemini/Tesseract:", e?.message);
    }
  }

  // If Gemini is available, use Gemini for optimal results
  if (genAI) {
    try {
      if (visionSuccess) {
        const aiImg = await prepareImageForAI(buf);
        const meta = await sharp(aiImg).metadata();
        const mime = toMime(meta?.format) || "image/jpeg";
        const systemPrompt = `You are a Legal Metrology & Retail label parser.
Review the RAW OCR text extracted by Vision and inspect the product packaging image to produce the cleanest, 100% accurate extracted text with all dates, batch numbers, MRP, and Net Quantity intact.
Return only the cleaned text lines.`;
        for (const modelName of GEMINI_FALLBACK_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const res = await model.generateContent([
              { text: systemPrompt },
              { text: `RAW_OCR:\n${base.text}` },
              { inlineData: { data: aiImg.toString("base64"), mimeType: mime } }
            ]);
            const cleaned = (await res.response.text())?.trim().replace(/```[a-z]*\n?|```/gi, "") || base.text;
            return { text: cleaned, confidence: 98, modelUsed: modelName };
          } catch (mErr) {
            console.warn(`[hybrid gemini] ${modelName} failed:`, mErr?.message);
          }
        }
      } else {
        // If Vision was not configured/failed, directly run Gemini OCR on the image
        return await runGeminiOCR(buf);
      }
    } catch (e) {
      console.warn("[runHybrid] Gemini cleanup failed:", e?.message);
    }
  }

  // Fallback to Tesseract if nothing else worked
  if (!visionSuccess) {
    base = await runTesseract(buf, "eng", false);
  }
  return base;
}

/* ===== 11) Provider selection ===== */
function pickProvider(explicit, availableEnvOrder) {
  if (explicit) return explicit;
  // Try env order, but only if configured
  const ok = (p) =>
    (p === "gemini" && !!genAI) ||
    (p === "vision" && !!visionClient) ||
    p === "tesseract" ||
    p === "hybrid"; // hybrid will handle its own fallbacks

  for (const p of availableEnvOrder || []) if (ok(p)) return p;
  // Default sensible order
  if (genAI) return "gemini";
  return "tesseract";
}

/* ===== 12) OCR Route ===== */
app.post("/api/ocr", upload.single("image"), async (req, res) => {
  const startedAt = Date.now();
  const lang = typeof req.body?.lang === "string" ? req.body.lang : "eng";
  const FAST = req.body?.fast === "true" || req.query?.fast === "1";
  const requested = (req.query.provider || req.body?.provider || "").toString().toLowerCase();
  const provider = pickProvider(requested, OCR_PROVIDERS);

  try {
    let inputBuffer = null;
    if (req.file?.buffer) inputBuffer = req.file.buffer;
    else if (req.body?.url) {
      const url = z.string().url().parse(req.body.url);
      const r = await fetch(url);
      if (!r.ok) return res.status(400).json({ error: "Could not fetch image URL" });
      inputBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      return res.status(400).json({ error: "Provide an image file or url" });
    }

    let out = { text: "", confidence: 0 };
    let usedProvider = provider;

    try {
      if (provider === "vision") out = await runVision(inputBuffer);
      else if (provider === "gemini") out = await runGeminiOCR(inputBuffer);
      else if (provider === "hybrid") out = await runHybrid(inputBuffer);
      else out = await runTesseract(inputBuffer, lang, FAST);
    } catch (providerError) {
      console.warn(`[/api/ocr] ${provider} failed (${providerError?.message || providerError}). Gracefully falling back to Tesseract...`);
      if (provider !== "tesseract") {
        out = await runTesseract(inputBuffer, lang, FAST);
        usedProvider = `tesseract (fallback from ${provider})`;
      } else {
        throw providerError;
      }
    }

    const fullText = out.text || "";
    const detectedFields = parseFields(fullText);
    const extractedText = fullText ? fullText.split(/\r?\n/).filter(Boolean) : [];
    const ms = Date.now() - startedAt;

    return res.json({
      provider: usedProvider,
      confidence: out.confidence,
      extractedText,
      detectedFields,
      ms,
      fast: !!FAST,
      modelUsed: out.modelUsed || undefined,
    });
  } catch (e) {
    console.error("[/api/ocr] error:", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/* ===== 12.1) OCR PDF Report Generation ===== */
app.post("/api/ocr/report", async (req, res) => {
  try {
    const {
      extractedText = [],
      detectedFields = {},
      confidence = 0,
      provider = "unknown",
      ms = 0,
      productImageUrl = null,
      modelUsed = null,
    } = req.body;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    // --- Color palette ---
    const COLOR_DARK    = "#1a1a2e";
    const COLOR_ACCENT  = "#3b5bdb";
    const COLOR_GREEN   = "#2f9e44";
    const COLOR_RED     = "#e03131";
    const COLOR_AMBER   = "#e67700";
    const COLOR_LIGHT   = "#f8f9fa";
    const COLOR_BORDER  = "#dee2e6";
    const COLOR_MUTED   = "#6c757d";
    const COLOR_WHITE   = "#ffffff";

    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="LM_Compliance_Report_${now.toISOString().slice(0,10)}.pdf"`
    );
    doc.pipe(res);

    const PAGE_W = doc.page.width - 100; // usable width (margins 50 each side)
    const COL_LEFT = 50;

    // ── Helper Functions ──────────────────────────────────────────────────────
    function drawRect(x, y, w, h, fillColor, strokeColor = null) {
      doc.save();
      doc.rect(x, y, w, h);
      if (fillColor) doc.fillColor(fillColor).fill();
      if (strokeColor) {
        doc.rect(x, y, w, h).strokeColor(strokeColor).stroke();
      }
      doc.restore();
    }

    function sectionHeader(label) {
      doc.moveDown(0.6);
      const y = doc.y;
      drawRect(COL_LEFT, y, PAGE_W, 24, COLOR_ACCENT);
      doc.fillColor(COLOR_WHITE).font("Helvetica-Bold").fontSize(10)
        .text(label.toUpperCase(), COL_LEFT + 10, y + 7, { width: PAGE_W - 20 });
      doc.y = y + 30;
      doc.fillColor(COLOR_DARK);
    }

    function kv(label, value, y) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_MUTED)
        .text(label, COL_LEFT, y, { width: 160, continued: false });
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_DARK)
        .text(String(value || "—"), COL_LEFT + 165, y, { width: PAGE_W - 165 });
    }

    // ── HEADER BANNER ─────────────────────────────────────────────────────────
    drawRect(0, 0, doc.page.width, 110, COLOR_DARK);
    doc.fillColor(COLOR_WHITE).font("Helvetica-Bold").fontSize(20)
      .text("Legal Metrology Compliance Report", 50, 22, { align: "left" });
    doc.font("Helvetica").fontSize(9).fillColor("#adb5bd")
      .text("Packaged Commodities Rules, 2011 (Amended up to 24.12.2024)", 50, 50);
    doc.font("Helvetica").fontSize(9).fillColor("#adb5bd")
      .text(`Generated: ${dateStr}  •  ${timeStr}`, 50, 65);

    // Compliance badge (overall)
    const totalFields = Object.keys(detectedFields).length || 1;
    const compliantCount = Object.values(detectedFields).filter(f => f.compliant).length;
    const overallScore = Math.round((compliantCount / totalFields) * 100);
    const badgeColor = overallScore >= 85 ? COLOR_GREEN : overallScore >= 60 ? COLOR_AMBER : COLOR_RED;
    const badgeLabel = overallScore >= 85 ? "COMPLIANT" : overallScore >= 60 ? "PARTIAL" : "NON-COMPLIANT";

    drawRect(doc.page.width - 160, 18, 110, 74, "transparent");
    doc.roundedRect(doc.page.width - 158, 20, 108, 70, 6).fillColor(badgeColor).fill();
    doc.fillColor(COLOR_WHITE).font("Helvetica-Bold").fontSize(22)
      .text(`${overallScore}%`, doc.page.width - 158, 28, { width: 108, align: "center" });
    doc.font("Helvetica-Bold").fontSize(9)
      .text(badgeLabel, doc.page.width - 158, 56, { width: 108, align: "center" });

    doc.y = 125;

    // ── SCAN METADATA ─────────────────────────────────────────────────────────
    sectionHeader("Scan Metadata");
    const meta = [
      ["OCR Engine", provider],
      ["Model / Provider Used", modelUsed || provider],
      ["Overall Confidence", `${Math.round(confidence)}%`],
      ["Server Processing Time", `${ms} ms`],
      ["Scan Date & Time", `${dateStr} at ${timeStr}`],
      ["Total Fields Evaluated", totalFields],
      ["Compliant Fields", compliantCount],
      ["Non-Compliant Fields", totalFields - compliantCount],
      ["Compliance Score", `${overallScore}%  —  ${badgeLabel}`],
    ];
    meta.forEach(([k, v]) => {
      kv(k, v, doc.y);
      doc.y += 16;
    });

    // ── EXTRACTED TEXT ────────────────────────────────────────────────────────
    sectionHeader("Raw Extracted Text (OCR Output)");
    const rawLines = Array.isArray(extractedText) ? extractedText : [];
    if (rawLines.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLOR_MUTED)
        .text("No text was extracted from the image.", COL_LEFT, doc.y);
      doc.y += 16;
    } else {
      drawRect(COL_LEFT, doc.y, PAGE_W, rawLines.length * 14 + 16, COLOR_LIGHT, COLOR_BORDER);
      let ty = doc.y + 8;
      rawLines.forEach((line) => {
        doc.font("Courier").fontSize(8).fillColor(COLOR_DARK)
          .text(line, COL_LEFT + 8, ty, { width: PAGE_W - 16 });
        ty += 14;
      });
      doc.y = ty + 8;
    }

    // ── FIELD VALIDATION RESULTS ──────────────────────────────────────────────
    sectionHeader("Field Validation Results — Legal Metrology Rules Check");

    const fieldOrder = [
      "productName", "manufacturer", "netQuantity", "mrp", "unitSalePrice",
      "batchNo", "mfgDate", "bestBefore", "countryOfOrigin", "consumerCare"
    ];
    const fieldDisplayNames = {
      productName:    "Generic / Common Name of Commodity",
      manufacturer:   "Manufacturer / Packer / Importer Details",
      netQuantity:    "Net Quantity",
      mrp:            "Maximum Retail Price (MRP)",
      unitSalePrice:  "Unit Sale Price (USP)",
      batchNo:        "Batch / Lot Number",
      mfgDate:        "Month & Year of Manufacture",
      bestBefore:     "Best Before / Use By Date",
      countryOfOrigin:"Country of Origin",
      consumerCare:   "Consumer Care / Grievance Details",
    };

    const orderedFields = [
      ...fieldOrder.filter(k => detectedFields[k]),
      ...Object.keys(detectedFields).filter(k => !fieldOrder.includes(k))
    ];

    orderedFields.forEach((fieldKey) => {
      const field = detectedFields[fieldKey];
      if (!field) return;

      // Check for page overflow
      if (doc.y > doc.page.height - 140) doc.addPage();

      const rowY = doc.y;
      const rowH = 66;
      const statusColor = field.compliant ? COLOR_GREEN : COLOR_RED;
      const rowBg = field.compliant ? "#f4fdf6" : "#fff4f4";

      // Row background
      drawRect(COL_LEFT, rowY, PAGE_W, rowH, rowBg, COLOR_BORDER);

      // Left accent strip
      drawRect(COL_LEFT, rowY, 4, rowH, statusColor);

      // Status badge
      const badgeW = 80;
      drawRect(COL_LEFT + PAGE_W - badgeW - 6, rowY + 6, badgeW, 18, statusColor);
      doc.fillColor(COLOR_WHITE).font("Helvetica-Bold").fontSize(8)
        .text(field.compliant ? "✓  COMPLIANT" : "✗  VIOLATION", COL_LEFT + PAGE_W - badgeW - 6, rowY + 10, { width: badgeW, align: "center" });

      // Field name
      const displayName = fieldDisplayNames[fieldKey] || fieldKey.replace(/([A-Z])/g, " $1").trim();
      doc.fillColor(COLOR_DARK).font("Helvetica-Bold").fontSize(10)
        .text(displayName, COL_LEFT + 12, rowY + 8, { width: PAGE_W - badgeW - 30 });

      // Rule reference
      if (field.ruleRef) {
        doc.fillColor(COLOR_ACCENT).font("Helvetica").fontSize(8)
          .text(`[${field.ruleRef}]`, COL_LEFT + 12, rowY + 22, { width: PAGE_W - badgeW - 30 });
      }

      // Extracted value
      const valueText = field.text ? `Detected: ${field.text}` : "Not detected on label";
      doc.fillColor(field.text ? COLOR_DARK : COLOR_MUTED)
        .font(field.text ? "Courier" : "Helvetica-Oblique").fontSize(8.5)
        .text(valueText, COL_LEFT + 12, rowY + 36, { width: PAGE_W - badgeW - 30 });

      // Notes / reason
      if (field.notes) {
        doc.fillColor(field.compliant ? COLOR_GREEN : COLOR_AMBER)
          .font("Helvetica-Oblique").fontSize(8)
          .text(`→ ${field.notes}`, COL_LEFT + 12, rowY + 50, { width: PAGE_W - badgeW - 30 });
      }

      doc.y = rowY + rowH + 6;
    });

    // ── SUMMARY TABLE ─────────────────────────────────────────────────────────
    if (doc.y > doc.page.height - 200) doc.addPage();
    sectionHeader("Compliance Summary");

    const violations = orderedFields
      .filter(k => detectedFields[k] && !detectedFields[k].compliant)
      .map(k => ({
        field: fieldDisplayNames[k] || k,
        ruleRef: detectedFields[k].ruleRef || "—",
        reason: detectedFields[k].notes || "Non-compliant",
      }));

    if (violations.length === 0) {
      doc.fillColor(COLOR_GREEN).font("Helvetica-Bold").fontSize(10)
        .text("✓  All detected fields comply with Legal Metrology (Packaged Commodities) Rules, 2011.", COL_LEFT, doc.y);
      doc.y += 16;
    } else {
      doc.fillColor(COLOR_DARK).font("Helvetica-Bold").fontSize(9)
        .text(`${violations.length} violation(s) found requiring corrective action:`, COL_LEFT, doc.y);
      doc.y += 14;

      violations.forEach((v, i) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const vy = doc.y;
        drawRect(COL_LEFT, vy, PAGE_W, 40, "#fff8f0", "#ffc9a0");
        drawRect(COL_LEFT, vy, 4, 40, COLOR_AMBER);
        doc.fillColor(COLOR_DARK).font("Helvetica-Bold").fontSize(9)
          .text(`${i + 1}. ${v.field}`, COL_LEFT + 12, vy + 6, { width: PAGE_W - 20 });
        doc.fillColor(COLOR_ACCENT).font("Helvetica").fontSize(8)
          .text(v.ruleRef, COL_LEFT + 12, vy + 19, { width: 200 });
        doc.fillColor(COLOR_AMBER).font("Helvetica-Oblique").fontSize(8)
          .text(v.reason, COL_LEFT + 12, vy + 29, { width: PAGE_W - 24 });
        doc.y = vy + 46;
      });
    }

    // ── LEGAL FOOTER ──────────────────────────────────────────────────────────
    const footerY = doc.page.height - 55;
    drawRect(0, footerY, doc.page.width, 55, COLOR_DARK);
    doc.fillColor("#adb5bd").font("Helvetica").fontSize(7.5)
      .text(
        "This report is auto-generated by the Legal Metrology Compliance Checker system. It is an indicative tool and does not substitute official inspection under the Legal Metrology Act, 2009.",
        50, footerY + 10, { width: doc.page.width - 100, align: "center" }
      );
    doc.fillColor("#6c757d").fontSize(7)
      .text(
        "Reference: Legal Metrology (Packaged Commodities) Rules, 2011 — Amended up to 24.12.2024  |  Ministry of Consumer Affairs, Food & Public Distribution, Government of India",
        50, footerY + 28, { width: doc.page.width - 100, align: "center" }
      );
    doc.fillColor("#495057").fontSize(7)
      .text(
        `Confidential  •  ${dateStr}  •  Page 1 of 1`,
        50, footerY + 42, { width: doc.page.width - 100, align: "center" }
      );

    doc.end();

  } catch (e) {
    console.error("[/api/ocr/report] error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  }
});

/* ===== 13) Product info route ===== */
app.get("/api/product-info", async (req, res) => {
  try {
    const inputUrl = z.string().url().parse(req.query.url);
    const mode = String(req.query.mode || "auto"); // sandbox | auto | html | browser

    const u0 = new URL(inputUrl);
    if (!isAllowedHost(u0.hostname)) {
      return res.status(400).json({ error: `Domain not allowed: ${u0.hostname}` });
    }

    console.log(`[product-info] mode=${mode} url=${inputUrl}`);

    if (mode === "sandbox") {
      const data = sandboxLookup(u0);
      if (!data) {
        console.warn("[sandbox] no fixture for", u0.href);
        return res.status(404).json({
          error: "Sandbox has no fixture for this URL/ID. Add a mock in SANDBOX map.",
        });
      }
      return res.json(data);
    }

    const tryHtml = async () => {
      const resp = await fetchWithTimeout(inputUrl, { redirect: "follow", headers: COMMON_HEADERS });
      if (!resp.ok) throw new Error(`Upstream returned ${resp.status}`);
      const finalUrl = resp.url || inputUrl;
      const u = new URL(finalUrl);
      if (!isAllowedHost(u.hostname)) throw new Error(`Final domain not allowed: ${u.hostname}`);
      const html = await resp.text();
      if (/robot|captcha|unusual\s+traffic|automated\s+access/i.test(html)) {
        console.warn("[html] robot/captcha detected; falling back to browser");
        return null;
      }
      return extractFromHtml(html, finalUrl);
    };

    if (mode === "html") {
      const data = await tryHtml();
      if (!data || !minimalOk(data)) return res.status(451).json({ error: "Extraction incomplete (html)." });
      return res.json(data);
    }

    if (mode === "browser") {
      const data = await extractWithBrowser(inputUrl);
      if (!minimalOk(data)) return res.status(451).json({ error: "Extraction incomplete (browser)." });
      return res.json(data);
    }

    // AUTO
    let data = await tryHtml();
    if (!data || !minimalOk(data)) {
      data = await extractWithBrowser(inputUrl);
      if (!minimalOk(data)) return res.status(451).json({ error: "Could not extract product details (auto)." });
    }
    return res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    console.error("[product-info] error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/* ===== 13.1) Legal Metrology Compliance Rule Engine Routes ===== */
app.get("/api/compliance/rules", (_req, res) => {
  return res.json(rulesConfig);
});

app.post("/api/evaluate-compliance", (req, res) => {
  try {
    const productData = req.body;
    if (!productData || typeof productData !== "object") {
      return res.status(400).json({ error: "Invalid product data payload." });
    }
    const evaluation = evaluateCompliance(productData);
    return res.json(evaluation);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Compliance evaluation failed";
    console.error("[evaluate-compliance] error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/* ===== 14) Live Product Crawling Functions (Added from old index.js) ===== */

/* ===== Live Product Crawling Route ===== */
app.post("/api/crawl-products", async (req, res) => {
  try {
    const { category, platform, maxProducts = 10 } = req.body;

    // Validate inputs
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    const validCategories = ['food', 'cosmetics', 'electronics', 'clothing', 'home-care'];
    const validPlatforms = ['amazon', 'flipkart', 'all'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    if (platform && !validPlatforms.includes(platform)) {
      return res.status(400).json({ error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` });
    }

    console.log(`[crawl-products] category=${category} platform=${platform} maxProducts=${maxProducts}`);

    // ONLY real crawling - NO MOCK DATA FALLBACK
    let products = [];

    try {
      console.log(`🚀 Starting REAL PRODUCT CRAWLING ONLY for category: ${category}, platform: ${platform}`);

      // Generate search URLs based on category and platform
      const searchUrls = generateSearchUrls(category, platform);
      console.log(`🔍 Generated ${searchUrls.length} search URLs:`, searchUrls);

      for (const searchUrl of searchUrls.slice(0, 2)) { // Limit to 2 platforms for demo
        try {
          console.log(`🔍 Attempting to crawl: ${searchUrl}`);
          const crawledProducts = await crawlProductsFromUrl(searchUrl, Math.min(5, maxProducts));
          console.log(`✅ Crawled ${crawledProducts.length} products from ${searchUrl}`);

          products.push(...crawledProducts);

          if (products.length >= maxProducts) break;
        } catch (error) {
          console.error(`❌ Failed to crawl ${searchUrl}:`, error.message);
          console.error(`📋 Error details:`, error.stack);
          continue;
        }
      }

      console.log(`🎯 Total REAL products found: ${products.length}`);

    } catch (error) {
      console.error(`❌ Real crawling completely failed:`, error.message);
      console.error(`📋 Error stack:`, error.stack);

      return res.status(500).json({
        error: 'Real product crawling failed',
        details: error.message,
        category,
        platform: platform || 'all',
        totalProducts: 0,
        products: [],
        timestamp: new Date().toISOString(),
        crawlStatus: 'failed'
      });
    }

    // Return ONLY real products or empty array if nothing found
    if (products.length === 0) {
      console.log(`❌ NO REAL PRODUCTS FOUND - returning empty results`);
      return res.json({
        category,
        platform: platform || 'all',
        totalProducts: 0,
        products: [],
        timestamp: new Date().toISOString(),
        crawlStatus: 'no_products_found',
        message: 'No real products could be crawled from the specified platforms'
      });
    }

    console.log(`🎉 Successfully retrieved ${products.length} REAL products!`);

    // Limit to requested number of products
    const limitedProducts = products.slice(0, maxProducts);

    // Add compliance analysis for each product
    const productsWithCompliance = await Promise.all(
      limitedProducts.map(async (product) => {
        try {
          // Simulate compliance analysis based on product name and available data
          const complianceResult = await analyzeProductCompliance(product);
          return {
            ...product,
            compliance: complianceResult
          };
        } catch (error) {
          console.warn(`[crawl-products] Compliance analysis failed for ${product.url}:`, error.message);
          return {
            ...product,
            compliance: {
              score: 0,
              status: 'error',
              violations: ['Analysis failed'],
              evidence: []
            }
          };
        }
      })
    );

    res.json({
      category,
      platform: platform || 'all',
      totalProducts: productsWithCompliance.length,
      products: productsWithCompliance,
      timestamp: new Date().toISOString(),
      source: 'real',
      crawlStatus: 'success'
    });

  } catch (error) {
    console.error("[crawl-products] error:", error);
    res.status(500).json({ error: error.message || "Failed to crawl products" });
  }
});

function generateMockProducts(category, platform, maxProducts) {
  const mockData = {
    food: [
      {
        id: `mock_${Date.now()}_1`,
        productName: 'Tata Tea Premium 1kg',
        price: '425',
        image: 'https://m.media-amazon.com/images/I/81Vm7YfQQhL._SX679_.jpg',
        url: 'https://www.amazon.in/Tata-Tea-Premium-1kg/dp/B00KDIALVQ',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_2`,
        productName: 'Dabur Honey 500g',
        price: '299',
        image: 'https://m.media-amazon.com/images/I/61FJPkOW+SL._SX679_.jpg',
        url: 'https://www.amazon.in/Dabur-Honey-Worlds-Natural-500g/dp/B00ETYC7LY',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_3`,
        productName: 'India Gate Basmati Rice 5kg',
        price: '850',
        image: 'https://m.media-amazon.com/images/I/81E6OVw4vYL._SX679_.jpg',
        url: 'https://www.amazon.in/India-Gate-Classic-Basmati-Rice/dp/B078WSQGPJ',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_4`,
        productName: 'Fortune Sunflower Oil 1L',
        price: '175',
        image: 'https://m.media-amazon.com/images/I/61RfXgCG4KL._SX679_.jpg',
        url: 'https://www.amazon.in/Fortune-Sunflower-Refined-Oil-1L/dp/B01G3MBF8G',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_5`,
        productName: 'Organic Honey (No MRP Label)',
        price: null,
        image: 'https://m.media-amazon.com/images/I/61SsXCKU4QL._SX679_.jpg',
        url: 'https://www.amazon.in/Organic-Natural-Honey-Raw-Unprocessed/dp/B08ZKZJCMR',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      }
    ],
    cosmetics: [
      {
        id: `mock_${Date.now()}_1`,
        productName: 'Lakme Face Cream 50g',
        price: '225',
        image: 'https://m.media-amazon.com/images/I/51A9HFqXeFL._SX679_.jpg',
        url: 'https://www.amazon.in/Lakme-Perfect-Radiance-Fairness-Cream/dp/B005KKG1EY',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_2`,
        productName: 'Himalaya Neem Face Wash 150ml',
        price: '89',
        image: 'https://m.media-amazon.com/images/I/61dJCNPzMJL._SX679_.jpg',
        url: 'https://www.amazon.in/Himalaya-Purifying-Neem-Face-Wash/dp/B00A8BZE8C',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      }
    ],
    electronics: [
      {
        id: `mock_${Date.now()}_1`,
        productName: 'Samsung Galaxy Buds2 Pro',
        price: '15999',
        image: 'https://m.media-amazon.com/images/I/61JzMcA1g9L._SX679_.jpg',
        url: 'https://www.amazon.in/Samsung-Galaxy-Buds2-Pro-Graphite/dp/B0B3JDC4F2',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_2`,
        productName: 'boAt Airdopes 131',
        price: '1299',
        image: 'https://m.media-amazon.com/images/I/61KoMJlwYsL._SX679_.jpg',
        url: 'https://www.amazon.in/boAt-Airdopes-131-Wireless-Earbuds/dp/B08RBRC8JN',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      }
    ],
    clothing: [
      {
        id: `mock_${Date.now()}_1`,
        productName: 'Levis Mens Jeans 32W',
        price: '2999',
        image: 'https://m.media-amazon.com/images/I/71g1x0c7AFL._UY879_.jpg',
        url: 'https://www.amazon.in/Levis-512-Slim-Taper-32W/dp/B07Q3TPRHJ',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_2`,
        productName: 'Allen Solly Mens Shirt',
        price: '1899',
        image: 'https://m.media-amazon.com/images/I/71QbOlhB6BL._UY879_.jpg',
        url: 'https://www.amazon.in/Allen-Solly-Regular-Shirt-ASSFWSLFSZ75746/dp/B086Q4ZFW9',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      }
    ],
    'home-care': [
      {
        id: `mock_${Date.now()}_1`,
        productName: 'Surf Excel Detergent 1kg',
        price: '299',
        image: 'https://m.media-amazon.com/images/I/71KVn9+JMNL._SX679_.jpg',
        url: 'https://www.amazon.in/Surf-Excel-Easy-Wash-Detergent/dp/B00A8BZE8C',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      },
      {
        id: `mock_${Date.now()}_2`,
        productName: 'Vim Dishwash Liquid 750ml',
        price: '125',
        image: 'https://m.media-amazon.com/images/I/61dN1PB8jdL._SX679_.jpg',
        url: 'https://www.amazon.in/Vim-Dishwash-Liquid-Gel-Lemon/dp/B01EQL0JKU',
        platform: 'Amazon',
        timestamp: new Date().toISOString(),
        source: 'mock'
      }
    ]
  };

  const categoryProducts = mockData[category] || mockData.food;

  // Filter by platform if specified
  let filteredProducts = categoryProducts;
  if (platform && platform !== 'all') {
    filteredProducts = categoryProducts.filter(p =>
      p.platform.toLowerCase() === platform.toLowerCase()
    );
  }

  // Duplicate products if we need more
  while (filteredProducts.length < maxProducts && categoryProducts.length > 0) {
    filteredProducts = [...filteredProducts, ...categoryProducts];
  }

  return filteredProducts.slice(0, maxProducts).map((product, index) => ({
    ...product,
    id: `mock_${category}_${Date.now()}_${index}`,
    timestamp: new Date().toISOString()
  }));
}

function generateSearchUrls(category, platform) {
  const searchTerms = {
    food: ['rice', 'honey', 'oil', 'tea', 'biscuits'],
    cosmetics: ['face cream', 'shampoo', 'soap', 'lotion'],
    electronics: ['phone', 'headphones', 'speaker', 'charger'],
    clothing: ['shirt', 'jeans', 'dress', 'shoes'],
    'home-care': ['detergent', 'cleaner', 'freshener', 'soap']
  };

  const terms = searchTerms[category] || ['product'];
  const urls = [];

  if (!platform || platform === 'all' || platform === 'amazon') {
    terms.forEach(term => {
      urls.push(`https://www.amazon.in/s?k=${encodeURIComponent(term)}&ref=sr_pg_1`);
    });
  }

  if (!platform || platform === 'all' || platform === 'flipkart') {
    terms.forEach(term => {
      urls.push(`https://www.flipkart.com/search?q=${encodeURIComponent(term)}`);
    });
  }

  return urls;
}

async function crawlProductsFromUrl(searchUrl, maxProducts) {
  console.log(`🚀 Starting real crawl for: ${searchUrl}`);

  let browser = null;
  const products = [];

  try {
    // Launch browser with basic configuration
    console.log(`📱 Launching browser...`);
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    console.log(`🌐 Creating new page...`);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      viewport: { width: 1366, height: 900 },
    });

    const page = await context.newPage();

    console.log(`🔗 Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    console.log(`⏱️ Waiting for page to load...`);
    await page.waitForTimeout(3000);

    const host = new URL(searchUrl).hostname.toLowerCase();
    console.log(`🏪 Detected platform: ${host}`);

    if (host.includes('amazon')) {
      console.log(`🛒 Extracting Amazon products...`);

      // Wait for Amazon search results
      try {
        await page.waitForSelector('[data-component-type="s-search-result"], .s-result-item', { timeout: 10000 });
        console.log(`✅ Amazon product containers found`);
      } catch (e) {
        console.log(`⚠️ Amazon selectors not found, continuing anyway...`);
      }

      const amazonProducts = await page.evaluate((max) => {
        console.log('🔍 Running Amazon extraction in browser...');
        const items = document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item');
        console.log(`📦 Found ${items.length} product containers`);

        const products = [];

        for (let i = 0; i < Math.min(items.length, max); i++) {
          const item = items[i];
          try {
            // Extract product name
            const nameSelectors = [
              'h2 a span:not([class*="sr-only"])',
              '.s-title-instructions-style h2 a span',
              '[data-cy="title-recipe-title"] span',
              '.a-size-base-plus'
            ];

            let productName = null;
            for (const selector of nameSelectors) {
              const nameEl = item.querySelector(selector);
              if (nameEl && nameEl.textContent.trim()) {
                productName = nameEl.textContent.trim();
                break;
              }
            }

            if (!productName) {
              console.log(`⚠️ No product name found for item ${i}`);
              continue;
            }

            // Extract price
            const priceSelectors = [
              '.a-price-whole',
              '.a-price .a-offscreen',
              '.a-price-range .a-offscreen'
            ];

            let price = null;
            for (const selector of priceSelectors) {
              const priceEl = item.querySelector(selector);
              if (priceEl) {
                const priceText = priceEl.textContent.replace(/[^\d]/g, '');
                if (priceText) {
                  price = priceText;
                  break;
                }
              }
            }

            // Extract image
            const imageEl = item.querySelector('.s-image, img');
            const image = imageEl ? (imageEl.src || imageEl.getAttribute('data-src')) : null;

            // Extract link
            const linkEl = item.querySelector('h2 a, .a-link-normal');
            const relativeUrl = linkEl ? linkEl.getAttribute('href') : null;
            const url = relativeUrl ? `https://amazon.in${relativeUrl}` : '#';

            products.push({
              id: `amazon_real_${Date.now()}_${i}`,
              productName: productName.substring(0, 100),
              price: price,
              image: image,
              url: url,
              platform: 'Amazon',
              timestamp: new Date().toISOString(),
              source: 'crawled'
            });

            console.log(`✅ Extracted product ${i + 1}: ${productName}`);

          } catch (e) {
            console.log(`❌ Error processing Amazon product ${i}:`, e.message);
          }
        }

        console.log(`🎯 Extracted ${products.length} Amazon products`);
        return products;
      }, maxProducts);

      products.push(...amazonProducts);
      console.log(`✅ Found ${amazonProducts.length} Amazon products`);

    } else if (host.includes('flipkart')) {
      console.log(`🛒 Extracting Flipkart products...`);

      // Wait for Flipkart search results
      try {
        await page.waitForSelector('[data-id], ._1AtVbE, ._13oc-S', { timeout: 10000 });
        console.log(`✅ Flipkart product containers found`);
      } catch (e) {
        console.log(`⚠️ Flipkart selectors not found, continuing anyway...`);
      }

      const flipkartProducts = await page.evaluate((max) => {
        console.log('🔍 Running Flipkart extraction in browser...');
        const items = document.querySelectorAll('[data-id], ._1AtVbE, ._13oc-S');
        console.log(`📦 Found ${items.length} product containers`);

        const products = [];

        for (let i = 0; i < Math.min(items.length, max); i++) {
          const item = items[i];
          try {
            // Extract product name
            const nameSelectors = [
              'a[title]',
              '.s1Q9rs',
              '._4rR01T',
              '.IRpwTa'
            ];

            let productName = null;
            for (const selector of nameSelectors) {
              const nameEl = item.querySelector(selector);
              if (nameEl) {
                const name = nameEl.getAttribute('title') || nameEl.textContent.trim();
                if (name) {
                  productName = name;
                  break;
                }
              }
            }

            if (!productName) {
              console.log(`⚠️ No product name found for item ${i}`);
              continue;
            }

            // Extract price
            const priceSelectors = [
              '._30jeq3',
              '._1_WHN1',
              '.hl05eU'
            ];

            let price = null;
            for (const selector of priceSelectors) {
              const priceEl = item.querySelector(selector);
              if (priceEl) {
                const priceText = priceEl.textContent.replace(/[^\d]/g, '');
                if (priceText) {
                  price = priceText;
                  break;
                }
              }
            }

            // Extract image
            const imageEl = item.querySelector('img');
            const image = imageEl ? (imageEl.src || imageEl.getAttribute('data-src')) : null;

            // Extract link
            const linkEl = item.querySelector('a[href]');
            const relativeUrl = linkEl ? linkEl.getAttribute('href') : null;
            const url = relativeUrl ? `https://flipkart.com${relativeUrl}` : '#';

            products.push({
              id: `flipkart_real_${Date.now()}_${i}`,
              productName: productName.substring(0, 100),
              price: price,
              image: image,
              url: url,
              platform: 'Flipkart',
              timestamp: new Date().toISOString(),
              source: 'crawled'
            });

            console.log(`✅ Extracted product ${i + 1}: ${productName}`);

          } catch (e) {
            console.log(`❌ Error processing Flipkart product ${i}:`, e.message);
          }
        }

        console.log(`🎯 Extracted ${products.length} Flipkart products`);
        return products;
      }, maxProducts);

      products.push(...flipkartProducts);
      console.log(`✅ Found ${flipkartProducts.length} Flipkart products`);
    }

  } catch (error) {
    console.error(`❌ Crawling error for ${searchUrl}:`, error.message);
    console.error(`📋 Error stack:`, error.stack);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log(`🔒 Browser closed for ${searchUrl}`);
      } catch (e) {
        console.log(`⚠️ Error closing browser:`, e.message);
      }
    }
  }

  console.log(`🎯 Total products crawled from ${searchUrl}: ${products.length}`);
  return products.filter(p => p.productName && p.productName.length > 3);
}

async function analyzeProductCompliance(product) {
  try {
    // Simulate compliance analysis based on product name and available data
    const mockCompliance = generateMockCompliance(product);

    // If product has an image, we could potentially run OCR here
    // For demo purposes, we'll use mock data with realistic patterns

    return mockCompliance;
  } catch (error) {
    console.error('Compliance analysis error:', error);
    return {
      score: 0,
      status: 'error',
      violations: ['Analysis failed'],
      evidence: []
    };
  }
}

function generateMockCompliance(product) {
  const productName = product.productName || "";
  const price = product.price;

  // Simulate OCR-style field detection like parseFields function
  const detectedFields = {
    productName: {
      text: productName,
      confidence: productName.length > 5 ? 85 : 20,
      compliant: productName.length > 5
    },
    netQuantity: {
      text: extractQuantity(productName),
      confidence: extractQuantity(productName) ? 80 : 0,
      compliant: !!extractQuantity(productName)
    },
    mrp: {
      text: price ? `₹${price}` : null,
      confidence: price ? 85 : 0,
      compliant: !!price
    },
    manufacturer: {
      text: extractManufacturer(productName),
      confidence: extractManufacturer(productName) ? 70 : 0,
      compliant: !!extractManufacturer(productName)
    },
    countryOfOrigin: {
      text: Math.random() > 0.6 ? "India" : null,
      confidence: Math.random() > 0.6 ? 75 : 0,
      compliant: Math.random() > 0.6
    },
    consumerCare: {
      text: Math.random() > 0.5 ? "1800-XXX-XXXX" : null,
      confidence: Math.random() > 0.5 ? 70 : 0,
      compliant: Math.random() > 0.5
    },
    bestBefore: {
      text: Math.random() > 0.7 ? "12 MONTHS" : null,
      confidence: Math.random() > 0.7 ? 65 : 0,
      compliant: Math.random() > 0.7
    }
  };

  // Calculate compliance score based on field detection (like OCR scanner)
  const totalFields = Object.keys(detectedFields).length;
  const compliantFields = Object.values(detectedFields).filter(field => field.compliant).length;
  const score = Math.round((compliantFields / totalFields) * 100);

  // Generate violations based on non-compliant fields
  const violations = [];
  const evidence = [];

  Object.entries(detectedFields).forEach(([fieldName, field]) => {
    const ruleMap = {
      productName: 'Rule 6(1) - Product Name Declaration',
      netQuantity: 'Rule 6(2) - Net Quantity Declaration',
      mrp: 'Rule 6(3) - Maximum Retail Price',
      manufacturer: 'Rule 6(4) - Manufacturer Details',
      countryOfOrigin: 'Rule 6(5) - Country of Origin',
      consumerCare: 'Rule 6(6) - Consumer Care Details',
      bestBefore: 'Rule 7 - Best Before Date'
    };

    evidence.push({
      field: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      found: field.compliant,
      value: field.text,
      rule: ruleMap[fieldName] || 'Legal Metrology Act',
      confidence: field.confidence / 100
    });

    if (!field.compliant) {
      violations.push(`${fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()} not properly declared as per ${ruleMap[fieldName]}`);
    }
  });

  // Determine status based on score (same as OCR scanner logic)
  let status = 'non-compliant';
  if (score >= 80) status = 'compliant';
  else if (score >= 60) status = 'partial-compliant';

  // Calculate overall OCR confidence (average of field confidences)
  const avgConfidence = Math.round(
    Object.values(detectedFields).reduce((sum, field) => sum + field.confidence, 0) / totalFields
  );

  return {
    score,
    status,
    violations,
    evidence,
    analysisTime: new Date().toISOString(),
    ocrConfidence: avgConfidence,
    totalFields,
    compliantFields,
    complianceRatio: `${compliantFields}/${totalFields}`,
    detectedFields // Include the raw field data like OCR scanner
  };
}

// Helper functions to extract information from product names
function extractQuantity(productName) {
  const quantityMatch = productName.match(/(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|gm|gram|litre|liter))/i);
  return quantityMatch ? quantityMatch[1] : null;
}

function extractManufacturer(productName) {
  // Extract first word (usually brand/manufacturer)
  const firstWord = productName.split(' ')[0];
  return firstWord && firstWord.length > 2 ? `${firstWord} India Pvt Ltd` : null;
}

/* ===== 15) ESP32 Routes ===== */

// Get ESP32 camera status
app.get("/api/esp32/status", async (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const response = await axios.get(`${ESP32_BASE_URL}${ESP32_ENDPOINTS.status}`, {
      timeout: 5000
    });
    res.json({
      online: true,
      status: response.data,
      esp32_url: ESP32_BASE_URL
    });
  } catch (error) {
    res.json({
      online: false,
      error: error.message,
      esp32_url: ESP32_BASE_URL
    });
  }
});

// Capture image from ESP32
app.post("/api/esp32/capture", async (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const response = await axios.get(`${ESP32_BASE_URL}${ESP32_ENDPOINTS.capture}`, {
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const imageBuffer = Buffer.from(response.data);

    // Optional: Also run OCR on captured image
    const runOCR = req.query.ocr === 'true';
    let ocrResult = null;

    if (runOCR) {
      const provider = pickProvider(req.query.provider, OCR_PROVIDERS);

      try {
        if (provider === "vision") ocrResult = await runVision(imageBuffer);
        else if (provider === "gemini") ocrResult = await runGeminiOCR(imageBuffer);
        else if (provider === "hybrid") ocrResult = await runHybrid(imageBuffer);
        else ocrResult = await runTesseract(imageBuffer, 'eng', false);
      } catch (ocrErr) {
        console.warn(`[esp32 ocr] ${provider} failed (${ocrErr?.message || ocrErr}), falling back to Tesseract`);
        ocrResult = await runTesseract(imageBuffer, 'eng', false);
      }

      // Add legal metrology field detection
      if (ocrResult) {
        ocrResult.detectedFields = parseFields(ocrResult.text || "");
      }
    }

    res.json({
      success: true,
      imageSize: imageBuffer.length,
      timestamp: new Date().toISOString(),
      ocrResult: runOCR ? ocrResult : null
    });

  } catch (error) {
    console.error('ESP32 capture error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ESP32 stream proxy
app.get("/api/esp32/stream", (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  res.setHeader('Content-Type', 'application/json');
  res.json({
    streamUrl: `${ESP32_BASE_URL}${ESP32_ENDPOINTS.stream}`,
    note: "Use this URL directly in your frontend for streaming"
  });
});

/* ===== 16) Barcode Routes ===== */

// Decode barcode from uploaded image
app.post("/api/barcode/decode", upload.single("image"), async (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    let imageBuffer = null;

    if (req.file?.buffer) {
      imageBuffer = req.file.buffer;
    } else if (req.body?.url) {
      const url = z.string().url().parse(req.body.url);
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ error: "Could not fetch image URL" });
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      return res.status(400).json({ error: "Provide an image file or URL" });
    }

    const barcode = await decodeBarcode(imageBuffer);

    if (!barcode) {
      return res.json({
        found: false,
        message: "No barcode detected in image"
      });
    }

    // Look up product info if requested
    const lookup = req.query.lookup === 'true' || req.body?.lookup === 'true';
    let productInfo = null;

    if (lookup) {
      productInfo = await lookupBarcodeInfo(barcode);
    }

    res.json({
      found: true,
      barcode,
      type: "auto-detected",
      productInfo: lookup ? productInfo : null
    });

  } catch (error) {
    console.error('Barcode decode error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Look up product by barcode number
app.get("/api/barcode/lookup/:barcode", async (req, res) => {

  console.log('=== BARCODE ROUTE HIT ===');
  console.log('Barcode param:', req.params.barcode);

  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const barcode = req.params.barcode;

    // Validate barcode format (basic check)
    if (!/^\d{8,14}$/.test(barcode)) {
      return res.status(400).json({
        error: "Invalid barcode format"
      });
    }


    console.log('🔍 Calling lookupBarcodeInfo...');
    const productInfo = await lookupBarcodeInfo(barcode);
    console.log('✅ Sending response:', productInfo);
    res.json(productInfo);


  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Combined ESP32 capture + barcode decode
app.post("/api/esp32/scan-barcode", async (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    // Capture from ESP32
    const captureResponse = await axios.get(`${ESP32_BASE_URL}${ESP32_ENDPOINTS.capture}`, {
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const imageBuffer = Buffer.from(captureResponse.data);

    // Decode barcode
    const barcode = await decodeBarcode(imageBuffer);

    if (!barcode) {
      return res.json({
        success: true,
        barcode: null,
        message: "Image captured but no barcode detected"
      });
    }

    // Look up product info if barcode API is available
    const productInfo = await lookupBarcodeInfo(barcode);

    res.json({
      success: true,
      barcode,
      productInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('ESP32 barcode scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===== 17) Updated Healthcheck ===== */
app.get("/health", async (_req, res) => {
  // Check ESP32 status
  let esp32Status = false;
  try {
    await axios.get(`${ESP32_BASE_URL}${ESP32_ENDPOINTS.status}`, { timeout: 3000 });
    esp32Status = true;
  } catch (error) {
    // ESP32 offline or unreachable
    esp32Status = false;
  }

  res.json({
    ok: true,
    providers: {
      gemini: !!genAI,
      vision: !!visionClient,
      tesseract: true,
    },
    services: {
      esp32: esp32Status,
      barcodeApi: true // Always available (free tier)
    },
    endpoints: {
      esp32_base: ESP32_BASE_URL,
      barcode_api: BARCODE_API_BASE
    }
  });
});

/* ===== 18) Handle OPTIONS requests for CORS ===== */
app.options('*', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

/* ===== 19) Start ===== */
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`ESP32 expected at: ${ESP32_BASE_URL}`);
  console.log(`Barcode API: Enabled (Free Tier)`);
  console.log(`Live Product Crawling: Enabled`);
});