// backend/server/geoService.js
// Indian PIN Code Geocoding, Manufacturing Hub Directory & Geospatial Compliance Aggregator

/**
 * Major Indian Manufacturing Hubs and PIN code coordinate lookup table
 */
export const PIN_GEO_DATABASE = {
  // Northern Hubs
  "173205": { name: "Baddi - Barotiwala - Nalagarh", district: "Solan", state: "Himachal Pradesh", lat: 30.9578, lng: 76.7914, hubType: "Pharma & Cosmetics" },
  "173220": { name: "Solan Industrial Area", district: "Solan", state: "Himachal Pradesh", lat: 30.9084, lng: 77.0999, hubType: "Pharma & FMCG" },
  "174101": { name: "Paonta Sahib", district: "Sirmaur", state: "Himachal Pradesh", lat: 30.4429, lng: 77.6256, hubType: "Pharmaceuticals" },
  "249403": { name: "SIDCUL Haridwar", district: "Haridwar", state: "Uttarakhand", lat: 29.9457, lng: 78.1642, hubType: "FMCG, Ayurveda & Pharma" },
  "263153": { name: "Pantnagar Industrial Area", district: "Udham Singh Nagar", state: "Uttarakhand", lat: 28.9866, lng: 79.4143, hubType: "Automobile & Packaged Goods" },
  "110020": { name: "Okhla Industrial Area", district: "South Delhi", state: "Delhi", lat: 28.5307, lng: 77.2713, hubType: "Electronics & Packaging" },
  "110028": { name: "Naraina Industrial Area", district: "West Delhi", state: "Delhi", lat: 28.6292, lng: 77.1352, hubType: "FMCG & Packaging" },
  "110033": { name: "Jahangirpuri / GT Karnal Road", district: "North Delhi", state: "Delhi", lat: 28.7266, lng: 77.1704, hubType: "Consumer Goods" },
  "122016": { name: "Manesar IMT", district: "Gurugram", state: "Haryana", lat: 28.3512, lng: 76.9388, hubType: "Electronics & Consumer Goods" },
  "121001": { name: "Faridabad Industrial Sector", district: "Faridabad", state: "Haryana", lat: 28.4089, lng: 77.3178, hubType: "Hardware & Packaged Goods" },
  "201301": { name: "Noida Industrial Hub Phase-II", district: "Gautam Buddha Nagar", state: "Uttar Pradesh", lat: 28.5355, lng: 77.3910, hubType: "Electronics & Food" },
  "201009": { name: "Ghaziabad Industrial Area", district: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lng: 77.4538, hubType: "Packaged Foods & Metals" },
  "141003": { name: "Ludhiana Industrial Focal Point", district: "Ludhiana", state: "Punjab", lat: 30.9010, lng: 75.8573, hubType: "Textiles & Packaged Commodities" },

  // Western Hubs
  "400013": { name: "Lower Parel / Mumbai Central", district: "Mumbai", state: "Maharashtra", lat: 18.9986, lng: 72.8306, hubType: "FMCG Headquarters & Importers" },
  "400604": { name: "Wagle Industrial Estate Thane", district: "Thane", state: "Maharashtra", lat: 19.1983, lng: 72.9511, hubType: "Chemicals, Cosmetics & Pharma" },
  "421506": { name: "Ambernath / Dombivli MIDC", district: "Thane", state: "Maharashtra", lat: 19.2081, lng: 73.1895, hubType: "Chemicals & Consumer Formulations" },
  "410501": { name: "Chakan MIDC", district: "Pune", state: "Maharashtra", lat: 18.7606, lng: 73.8617, hubType: "Automobile & Packaged Goods" },
  "411018": { name: "Pimpri-Chinchwad Industrial Belt", district: "Pune", state: "Maharashtra", lat: 18.6298, lng: 73.7997, hubType: "FMCG, Pharma & Electronics" },
  "431136": { name: "Waluj MIDC Aurangabad", district: "Chhatrapati Sambhaji Nagar", state: "Maharashtra", lat: 19.8335, lng: 75.2443, hubType: "Pharma & Auto" },
  "395001": { name: "Surat GIDC / Pandesara", district: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311, hubType: "Textiles, Chemicals & Packaging" },
  "380015": { name: "Sanand / Changodar Industrial Area", district: "Ahmedabad", state: "Gujarat", lat: 22.9868, lng: 72.4965, hubType: "Pharma, Food & FMCG" },
  "390001": { name: "Vadodara Petrochemical & GIDC", district: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812, hubType: "Pharma & Cosmetics" },
  "393001": { name: "Ankleshwar GIDC", district: "Bharuch", state: "Gujarat", lat: 21.6264, lng: 73.0033, hubType: "Bulk Drugs & Chemicals" },
  "396195": { name: "Vapi Industrial Estate", district: "Valsad", state: "Gujarat", lat: 20.3705, lng: 72.9106, hubType: "Paper, Plastics & Pharma" },
  "452001": { name: "Pithampur Industrial Zone", district: "Dhar / Indore", state: "Madhya Pradesh", lat: 22.6074, lng: 75.6882, hubType: "Pharma, Food & Heavy Industries" },

  // Southern Hubs
  "560058": { name: "Peenya Industrial Area", district: "Bengaluru Urban", state: "Karnataka", lat: 13.0285, lng: 77.5197, hubType: "Electronics & Precision Manufacturing" },
  "560100": { name: "Electronic City", district: "Bengaluru Urban", state: "Karnataka", lat: 12.8452, lng: 77.6602, hubType: "Electronics & IT Hardware" },
  "500037": { name: "Balanagar / Sanathnagar Industrial Area", district: "Hyderabad", state: "Telangana", lat: 17.4646, lng: 78.4414, hubType: "Pharma & Electricals" },
  "502319": { name: "Pashamylaram / Patancheru IDA", district: "Sangareddy / Hyderabad", state: "Telangana", lat: 17.5342, lng: 78.2327, hubType: "Pharma Bulk Formulations" },
  "600058": { name: "Ambattur Industrial Estate", district: "Chennai", state: "Tamil Nadu", lat: 13.0978, lng: 80.1611, hubType: "FMCG, Auto & Electronics" },
  "600096": { name: "Perungudi / OMR Industrial Estate", district: "Chennai", state: "Tamil Nadu", lat: 12.9644, lng: 80.2443, hubType: "Electronics & Packaging" },
  "641018": { name: "Coimbatore Industrial Belt", district: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558, hubType: "Textiles, Motors & Food" },
  "625001": { name: "Madurai Industrial Cluster", district: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198, hubType: "Food Processing & Rubber" },
  "682024": { name: "Kalamassery / Ernakulam Industrial", district: "Ernakulam", state: "Kerala", lat: 10.0537, lng: 76.3217, hubType: "Food & Spices Packaging" },

  // Eastern Hubs
  "700015": { name: "Tangra / Kolkata Industrial Hub", district: "Kolkata", state: "West Bengal", lat: 22.5517, lng: 77.3820, hubType: "Leather, FMCG & Plastics" },
  "711101": { name: "Howrah Industrial Belt", district: "Howrah", state: "West Bengal", lat: 22.5958, lng: 88.2636, hubType: "Engineering & Packaging" },
  "751010": { name: "Mancheswar Industrial Estate", district: "Khurda / Bhubaneswar", state: "Odisha", lat: 20.3168, lng: 85.8617, hubType: "Food & Packaging" },
  "781001": { name: "Guwahati Industrial Cluster", district: "Kamrup Metropolitan", state: "Assam", lat: 26.1445, lng: 91.7362, hubType: "Tea & North-East FMCG Hub" },
};

// Approximate fallback coordinates by major state/district name
export const REGION_FALLBACKS = {
  "himachal pradesh": { lat: 31.1048, lng: 77.1734, district: "Solan", pin: "173205", name: "Himachal Pharma Belt" },
  "solan": { lat: 30.9084, lng: 77.0999, district: "Solan", pin: "173205", name: "Solan Industrial Zone" },
  "baddi": { lat: 30.9578, lng: 76.7914, district: "Solan", pin: "173205", name: "Baddi Industrial Area" },
  "uttarakhand": { lat: 30.0668, lng: 79.0193, district: "Haridwar", pin: "249403", name: "SIDCUL Uttarakhand" },
  "haridwar": { lat: 29.9457, lng: 78.1642, district: "Haridwar", pin: "249403", name: "Haridwar Industrial Area" },
  "delhi": { lat: 28.6139, lng: 77.2090, district: "South Delhi", pin: "110020", name: "Delhi Industrial Hub" },
  "noida": { lat: 28.5355, lng: 77.3910, district: "Gautam Buddha Nagar", pin: "201301", name: "Noida Industrial Area" },
  "gurugram": { lat: 28.4595, lng: 77.0266, district: "Gurugram", pin: "122016", name: "Gurugram IMT" },
  "gurgaon": { lat: 28.4595, lng: 77.0266, district: "Gurugram", pin: "122016", name: "Gurugram IMT" },
  "gujarat": { lat: 22.2587, lng: 71.1924, district: "Ahmedabad", pin: "380015", name: "Gujarat Industrial Hub" },
  "surat": { lat: 21.1702, lng: 72.8311, district: "Surat", pin: "395001", name: "Surat GIDC" },
  "ahmedabad": { lat: 23.0225, lng: 72.5714, district: "Ahmedabad", pin: "380015", name: "Ahmedabad Industrial Area" },
  "maharashtra": { lat: 19.7515, lng: 75.7139, district: "Mumbai", pin: "400013", name: "Maharashtra Industrial Belt" },
  "mumbai": { lat: 19.0760, lng: 72.8777, district: "Mumbai", pin: "400013", name: "Mumbai Industrial Zone" },
  "pune": { lat: 18.5204, lng: 73.8567, district: "Pune", pin: "411018", name: "Pune MIDC Hub" },
  "thane": { lat: 19.2183, lng: 72.9781, district: "Thane", pin: "400604", name: "Thane Wagle MIDC" },
  "karnataka": { lat: 15.3173, lng: 75.7139, district: "Bengaluru", pin: "560058", name: "Karnataka Industrial Belt" },
  "bangalore": { lat: 12.9716, lng: 77.5946, district: "Bengaluru Urban", pin: "560058", name: "Peenya Industrial Area" },
  "bengaluru": { lat: 12.9716, lng: 77.5946, district: "Bengaluru Urban", pin: "560058", name: "Peenya Industrial Area" },
  "telangana": { lat: 18.1124, lng: 79.0193, district: "Hyderabad", pin: "500037", name: "Hyderabad Pharma City" },
  "hyderabad": { lat: 17.3850, lng: 78.4867, district: "Hyderabad", pin: "500037", name: "Hyderabad Pharma City" },
  "tamil nadu": { lat: 11.1271, lng: 78.6569, district: "Chennai", pin: "600058", name: "Tamil Nadu Manufacturing Hub" },
  "chennai": { lat: 13.0827, lng: 80.2707, district: "Chennai", pin: "600058", name: "Ambattur Chennai" },
  "west bengal": { lat: 22.9868, lng: 87.8550, district: "Kolkata", pin: "700015", name: "Kolkata Industrial Zone" },
  "kolkata": { lat: 22.5726, lng: 88.3639, district: "Kolkata", pin: "700015", name: "Kolkata Industrial Zone" },
  "madhya pradesh": { lat: 22.9734, lng: 78.6569, district: "Indore", pin: "452001", name: "Pithampur Industrial Hub" },
  "indore": { lat: 22.7196, lng: 75.8577, district: "Indore", pin: "452001", name: "Pithampur MP" },
};

/**
 * Extract 6-digit Indian PIN code and location coordinates from address or OCR text
 */
export function extractGeoLocation(addressText, rawOcrText = "") {
  const combined = `${addressText || ""} ${rawOcrText || ""}`;
  
  // 1. Match explicit 6-digit Indian PIN Code (e.g. 110001, 173 205, PIN: 395001)
  const pinMatch = combined.match(/(?:PIN(?:CODE)?|POSTAL\s*CODE)?\s*[:\.\-]?\s*([1-9][0-9]{2}\s?[0-9]{3})\b/i);
  if (pinMatch) {
    const cleanPin = pinMatch[1].replace(/\s+/g, "");
    if (PIN_GEO_DATABASE[cleanPin]) {
      return {
        pincode: cleanPin,
        ...PIN_GEO_DATABASE[cleanPin],
        matchedBy: "pin_exact"
      };
    }
  }

  // 2. Match known industrial hub names or city/state keywords
  const lower = combined.toLowerCase();
  for (const [key, fallback] of Object.entries(REGION_FALLBACKS)) {
    if (lower.includes(key)) {
      return {
        pincode: fallback.pin,
        name: fallback.name,
        district: fallback.district,
        state: fallback.state || (key.charAt(0).toUpperCase() + key.slice(1)),
        lat: fallback.lat,
        lng: fallback.lng,
        hubType: "General Manufacturing",
        matchedBy: "region_keyword"
      };
    }
  }

  // 3. Fallback default if address is generic Indian manufacturing
  return {
    pincode: "110020",
    name: "Okhla / Delhi NCR Industrial Hub",
    district: "South Delhi",
    state: "Delhi",
    lat: 28.5307,
    lng: 77.2713,
    hubType: "Central Manufacturing",
    matchedBy: "default_fallback"
  };
}

/**
 * In-memory location audit logs to aggregate scanned and crawled products
 */
let liveGeoLogs = [
  // Realistic pre-seeded manufacturing audit records across Indian manufacturing hubs
  {
    id: "geo-1",
    productName: "Cetaphil Gentle Skin Cleanser 125ml",
    manufacturer: "Encube Ethicals Pvt. Ltd., Plot No. C-1, Madkaim Industrial Estate, Goa - 403404",
    pincode: "173205",
    locationName: "Baddi - Barotiwala Hub",
    district: "Solan",
    state: "Himachal Pradesh",
    lat: 30.9578,
    lng: 76.7914,
    complianceScore: 55, // Critical Red
    isCompliant: false,
    violations: [
      { field: "Manufacturer Address", ruleRef: "Rule 6(1)(a)", description: "Complete factory postal address with PIN missing on PDP" },
      { field: "Country of Origin", ruleRef: "Rule 6(1)(aa)", description: "Country of Origin declaration not found" },
      { field: "Consumer Care", ruleRef: "Rule 6(2)", description: "Missing consumer helpline number" }
    ],
    category: "Cosmetics & Pharma",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-2",
    productName: "Ayurvedic Pain Relief Oil 100ml",
    manufacturer: "Patanjali Ayurved Ltd., SIDCUL Industrial Area, Haridwar - 249403",
    pincode: "249403",
    locationName: "SIDCUL Haridwar",
    district: "Haridwar",
    state: "Uttarakhand",
    lat: 29.9457,
    lng: 78.1642,
    complianceScore: 70, // Orange
    isCompliant: false,
    violations: [
      { field: "Unit Sale Price", ruleRef: "Rule 6(11)", description: "USP per ml not declared" },
      { field: "MRP Format", ruleRef: "Rule 6(1)(e)", description: "Missing 'inclusive of all taxes' suffix" }
    ],
    category: "Ayurveda & FMCG",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-3",
    productName: "Premium Synthetic Saree & Fabric",
    manufacturer: "Surat Textile Packagers, GIDC Pandesara, Surat - 395001",
    pincode: "395001",
    locationName: "Surat GIDC Hub",
    district: "Surat",
    state: "Gujarat",
    lat: 21.1702,
    lng: 72.8311,
    complianceScore: 48, // Critical Red
    isCompliant: false,
    violations: [
      { field: "Dimensions", ruleRef: "Rule 6(1)(f) / Rule 14", description: "Length & width in metres not declared" },
      { field: "Consumer Care", ruleRef: "Rule 6(2)", description: "Customer care email and toll-free missing" },
      { field: "MRP", ruleRef: "Rule 6(1)(e)", description: "Overwritten price sticker detected" }
    ],
    category: "Textiles & Commodities",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-4",
    productName: "Organic Multi-Flora Honey 500g",
    manufacturer: "Dabur India Ltd., Okhla Industrial Area Phase-III, New Delhi - 110020",
    pincode: "110020",
    locationName: "Okhla Industrial Area",
    district: "South Delhi",
    state: "Delhi",
    lat: 28.5307,
    lng: 77.2713,
    complianceScore: 94, // Compliant Green
    isCompliant: true,
    violations: [],
    category: "Packaged Food",
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-5",
    productName: "Herbal Hair Care Serum 100ml",
    manufacturer: "Marico Limited, Wagle Industrial Estate, Thane - 400604",
    pincode: "400604",
    locationName: "Wagle Industrial Estate Thane",
    district: "Thane",
    state: "Maharashtra",
    lat: 19.1983,
    lng: 72.9511,
    complianceScore: 88, // Compliant Green
    isCompliant: true,
    violations: [],
    category: "Cosmetics",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-6",
    productName: "Protein Whey Isolate 1kg",
    manufacturer: "Nutra Nutrition Labs, Peenya Industrial Area, Bengaluru - 560058",
    pincode: "560058",
    locationName: "Peenya Industrial Area",
    district: "Bengaluru Urban",
    state: "Karnataka",
    lat: 13.0285,
    lng: 77.5197,
    complianceScore: 62, // Orange
    isCompliant: false,
    violations: [
      { field: "Net Quantity", ruleRef: "Rule 6(1)(c)", description: "Exaggerating word 'Approx' used with net weight" },
      { field: "USP", ruleRef: "Rule 6(11)", description: "USP per 100g calculated incorrectly" }
    ],
    category: "Health Supplements",
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-7",
    productName: "Active Antiseptic Liquid 250ml",
    manufacturer: "Balanagar Pharma Formulations, Sanathnagar, Hyderabad - 500037",
    pincode: "500037",
    locationName: "Hyderabad Pharma City",
    district: "Hyderabad",
    state: "Telangana",
    lat: 17.4646,
    lng: 78.4414,
    complianceScore: 78, // Yellow
    isCompliant: false,
    violations: [
      { field: "Date of Manufacture", ruleRef: "Rule 6(1)(d)", description: "Month & year font height less than 1.5mm (Rule 7)" }
    ],
    category: "Pharmaceuticals",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "geo-8",
    productName: "Refined Sunflower Oil 1 Litre",
    manufacturer: "Pithampur Oil Processing Hub, Dhar, Indore - 452001",
    pincode: "452001",
    locationName: "Pithampur Industrial Zone",
    district: "Indore",
    state: "Madhya Pradesh",
    lat: 22.6074,
    lng: 75.6882,
    complianceScore: 52, // Critical Red
    isCompliant: false,
    violations: [
      { field: "Standard Pack Size", ruleRef: "Rule 5 / Second Schedule", description: "Non-standard quantity packaging" },
      { field: "MRP", ruleRef: "Rule 6(1)(e)", description: "MRP missing tax disclaimer" }
    ],
    category: "Edible Oils",
    timestamp: new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString()
  }
];

/**
 * Record a new scan into the geospatial audit logs
 */
export function recordGeoScan(scanData) {
  const geo = extractGeoLocation(scanData.manufacturer || "", scanData.extractedText || "");
  const record = {
    id: `geo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    productName: scanData.productName || "Scanned Packaged Commodity",
    manufacturer: scanData.manufacturer || geo.name,
    pincode: geo.pincode,
    locationName: geo.name,
    district: geo.district,
    state: geo.state,
    lat: geo.lat,
    lng: geo.lng,
    complianceScore: scanData.complianceScore ?? (scanData.isCompliant ? 95 : 60),
    isCompliant: Boolean(scanData.isCompliant),
    violations: scanData.violations || [],
    category: scanData.category || geo.hubType || "Packaged Goods",
    timestamp: new Date().toISOString()
  };

  liveGeoLogs.unshift(record);
  if (liveGeoLogs.length > 500) liveGeoLogs.pop(); // Keep manageable memory buffer
  return record;
}

/**
 * Aggregate geospatial data by PIN code / Manufacturing Location
 */
export function getGeospatialComplianceData(filters = {}) {
  let logs = [...liveGeoLogs];

  // Filter by timeframe
  if (filters.timeframe === "today") {
    const today = new Date().toISOString().slice(0, 10);
    logs = logs.filter(l => l.timestamp.startsWith(today));
  } else if (filters.timeframe === "7d") {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    logs = logs.filter(l => new Date(l.timestamp) >= cutoff);
  } else if (filters.timeframe === "30d") {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    logs = logs.filter(l => new Date(l.timestamp) >= cutoff);
  }

  // Filter by category
  if (filters.category && filters.category !== "all") {
    logs = logs.filter(l => (l.category || "").toLowerCase().includes(filters.category.toLowerCase()));
  }

  // Filter by state
  if (filters.state && filters.state !== "all") {
    logs = logs.filter(l => (l.state || "").toLowerCase() === filters.state.toLowerCase());
  }

  // Group by PIN code
  const pinMap = new Map();

  for (const log of logs) {
    const pin = log.pincode;
    if (!pinMap.has(pin)) {
      pinMap.set(pin, {
        pincode: pin,
        locationName: log.locationName,
        district: log.district,
        state: log.state,
        lat: log.lat,
        lng: log.lng,
        totalScans: 0,
        compliantScans: 0,
        nonCompliantScans: 0,
        totalScore: 0,
        violationsCount: 0,
        ruleViolations: {},
        products: [],
        categories: new Set()
      });
    }

    const hub = pinMap.get(pin);
    hub.totalScans += 1;
    hub.totalScore += (log.complianceScore || 0);
    if (log.isCompliant) {
      hub.compliantScans += 1;
    } else {
      hub.nonCompliantScans += 1;
    }
    hub.categories.add(log.category);

    (log.violations || []).forEach(v => {
      hub.violationsCount += 1;
      const rule = v.ruleRef || v.field || "General LM Violation";
      hub.ruleViolations[rule] = (hub.ruleViolations[rule] || 0) + 1;
    });

    hub.products.push({
      id: log.id,
      productName: log.productName,
      score: log.complianceScore,
      isCompliant: log.isCompliant,
      violationsCount: (log.violations || []).length,
      timestamp: log.timestamp
    });
  }

  // Calculate final aggregated statistics & severity classification
  const clusters = Array.from(pinMap.values()).map(hub => {
    const avgScore = hub.totalScans > 0 ? Math.round(hub.totalScore / hub.totalScans) : 0;
    const defectRate = hub.totalScans > 0 ? Math.round((hub.nonCompliantScans / hub.totalScans) * 100) : 0;
    
    // Severity mapping:
    // Red (Critical Non-Compliance): avgScore < 60% OR defectRate >= 60%
    // Orange (High Risk): avgScore 60% - 74%
    // Yellow (Moderate Risk): avgScore 75% - 84%
    // Green (Compliant Hub): avgScore >= 85%
    let riskLevel = "green";
    let riskLabel = "Compliant";
    let color = "#10B981"; // Green
    let pulseIntensity = 0;

    if (avgScore < 60 || defectRate >= 60) {
      riskLevel = "red";
      riskLabel = "Critical Non-Compliance (Most Violations)";
      color = "#EF4444"; // Red
      pulseIntensity = 3;
    } else if (avgScore < 75 || defectRate >= 35) {
      riskLevel = "orange";
      riskLabel = "High Risk / Repeated Defects";
      color = "#F97316"; // Orange
      pulseIntensity = 2;
    } else if (avgScore < 85 || defectRate > 0) {
      riskLevel = "yellow";
      riskLabel = "Moderate / Minor Violations";
      color = "#EAB308"; // Yellow
      pulseIntensity = 1;
    }

    // Sort top violated rules
    const topViolations = Object.entries(hub.ruleViolations)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      pincode: hub.pincode,
      locationName: hub.locationName,
      district: hub.district,
      state: hub.state,
      lat: hub.lat,
      lng: hub.lng,
      totalScans: hub.totalScans,
      compliantScans: hub.compliantScans,
      nonCompliantScans: hub.nonCompliantScans,
      avgComplianceScore: avgScore,
      defectRate,
      violationsCount: hub.violationsCount,
      riskLevel,
      riskLabel,
      color,
      pulseIntensity,
      topViolations,
      categories: Array.from(hub.categories),
      recentProducts: hub.products.slice(0, 5)
    };
  });

  // Sort clusters by worst compliance score first (Hotspots)
  clusters.sort((a, b) => a.avgComplianceScore - b.avgComplianceScore);

  // Compute state-level summary
  const stateSummary = {};
  clusters.forEach(c => {
    if (!stateSummary[c.state]) {
      stateSummary[c.state] = {
        state: c.state,
        totalScans: 0,
        nonCompliantScans: 0,
        scoreSum: 0,
        hubsCount: 0,
        criticalHubs: 0
      };
    }
    const s = stateSummary[c.state];
    s.totalScans += c.totalScans;
    s.nonCompliantScans += c.nonCompliantScans;
    s.scoreSum += (c.avgComplianceScore * c.totalScans);
    s.hubsCount += 1;
    if (c.riskLevel === "red") s.criticalHubs += 1;
  });

  const stateRankings = Object.values(stateSummary).map(s => ({
    state: s.state,
    totalScans: s.totalScans,
    avgScore: s.totalScans > 0 ? Math.round(s.scoreSum / s.totalScans) : 0,
    defectRate: s.totalScans > 0 ? Math.round((s.nonCompliantScans / s.totalScans) * 100) : 0,
    hubsCount: s.hubsCount,
    criticalHubs: s.criticalHubs
  })).sort((a, b) => a.avgScore - b.avgScore);

  const totalScans = logs.length;
  const totalViolations = logs.filter(l => !l.isCompliant).length;
  const nationalAvgScore = totalScans > 0 ? Math.round(logs.reduce((a, b) => a + (b.complianceScore || 0), 0) / totalScans) : 0;
  const criticalHubsCount = clusters.filter(c => c.riskLevel === "red").length;

  return {
    kpis: {
      totalScans,
      totalViolations,
      nationalAvgScore,
      criticalHubsCount,
      totalTrackedHubs: clusters.length,
      defectRatePct: totalScans > 0 ? Math.round((totalViolations / totalScans) * 100) : 0
    },
    clusters,
    stateRankings,
    totalLogs: logs.length
  };
}
