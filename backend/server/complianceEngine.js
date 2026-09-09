// backend/server/complianceEngine.js
// Deterministic Legal Metrology (Packaged Commodities) Rules, 2011 checker (amended up to 24.12.2024).
// Pair this with rulesConfig.json. Feed it structured product data extracted
// from OCR / a product listing / a scraper.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "rulesConfig.json"), "utf8")
);

// ---------- Helpers ----------

function isSmallPackExempt(productData) {
  const g = parseFloat(productData.netQuantityValue);
  const unit = (productData.netQuantityUnit || "").toLowerCase();
  const isTobacco = /tobacco|bidi|cigarette/i.test(productData.category || "");
  if (isTobacco) return false;
  if ((unit === "g" || unit === "ml") && g <= 10) return true;
  return false;
}

function isExempt(productData) {
  if (isSmallPackExempt(productData)) return { exempt: true, reason: "net qty <= 10g/10ml (Rule 26(a))" };
  if (/restaurant|hotel|fast.?food/i.test(productData.category || "")) {
    return { exempt: true, reason: "fast food packed by restaurant/hotel (Rule 26(b))" };
  }
  if (productData.isScheduledDrugFormulation && !productData.isMedicalDeviceDeclaredAsDrug) {
    return { exempt: true, reason: "DPCO scheduled/non-scheduled formulation (Rule 26(c))" };
  }
  return { exempt: false };
}

function checkMRPFormat(mrpString) {
  if (!mrpString) return false;
  // Format check: Maximum or Max Retail Price Rs./₹ xx.xx (inclusive / incl. of all taxes)
  const re = /(mrp|max(imum)?\.?\s*retail\s*price)[^0-9]*(rs\.?|₹)\s*\d+(\.\d{1,2})?.*(inclusive|incl\.?\s*of\s*all\s*taxes)/i;
  // Also tolerate basic format if numbers and tax disclaimer match
  const altRe = /(rs\.?|₹)\s*\d+(\.\d{1,2})?.*(incl(usive)?\s*(of)?\s*all\s*taxes)/i;
  return re.test(mrpString) || altRe.test(mrpString);
}

function computeExpectedUSP(price, qtyValue, qtyUnit) {
  const unit = (qtyUnit || "").toLowerCase();
  let base, per;
  if (unit === "g" || unit === "kg") {
    base = unit === "kg" ? qtyValue * 1000 : qtyValue;
    per = base < 1000 ? "g" : "kg";
    const denom = per === "g" ? base : base / 1000;
    return { value: +(price / denom).toFixed(2), per };
  }
  if (unit === "ml" || unit === "l" || unit === "litre") {
    base = (unit === "l" || unit === "litre") ? qtyValue * 1000 : qtyValue;
    per = base < 1000 ? "ml" : "litre";
    const denom = per === "ml" ? base : base / 1000;
    return { value: +(price / denom).toFixed(2), per };
  }
  if (unit === "cm" || unit === "m" || unit === "metre" || unit === "meter") {
    base = (unit === "m" || unit === "metre" || unit === "meter") ? qtyValue * 100 : qtyValue;
    per = base < 100 ? "cm" : "metre";
    const denom = per === "cm" ? base : base / 100;
    return { value: +(price / denom).toFixed(2), per };
  }
  if (unit === "number" || unit === "unit" || unit === "piece" || unit === "n" || unit === "u") {
    return { value: +(price / qtyValue).toFixed(2), per: "unit" };
  }
  return null;
}

function uspRequired(productData) {
  if (
    productData.retailSalePrice != null &&
    productData.unitSalePrice != null &&
    Math.abs(productData.retailSalePrice - productData.unitSalePrice) < 0.01
  ) {
    return false;
  }
  if (["combination", "group", "multi-piece"].includes(productData.packageType)) return false;
  return true;
}

// ---------- Main Evaluator ----------

export function evaluateCompliance(productData) {
  const violations = [];
  let score = 100;

  const exemption = isExempt(productData);
  if (exemption.exempt) {
    return {
      complianceScore: 100,
      isCompliant: true,
      exempt: true,
      exemptionReason: exemption.reason,
      violations: [],
      passedChecks: rulesConfig.mandatoryFields.length,
      totalChecks: rulesConfig.mandatoryFields.length,
    };
  }

  const deduct = (field, ruleRef, severity, description, weight) => {
    violations.push({
      field,
      ruleRef,
      status: "missing",
      severity,
      description,
      deduction: weight,
    });
    score -= weight;
  };

  // 1. Manufacturer / packer / importer
  if (!productData.manufacturer || productData.manufacturer.trim().length < 10) {
    deduct(
      "Manufacturer/Packer/Importer",
      "Rule 6(1)(a) / Rule 10",
      "high",
      "Complete name and postal address (with PIN) is missing or too short.",
      15
    );
  }

  // 2. Country of origin (mandatory for imported goods & e-commerce)
  if ((productData.isImported || productData.soldViaEcommerce !== false) && !productData.countryOfOrigin) {
    deduct(
      "Country of Origin",
      "Rule 6(1)(aa) / Rule 6(10)",
      "high",
      "Country of origin is mandatory for imported products and all e-commerce listings.",
      10
    );
  }

  // 3. Generic name
  if (!productData.productName || productData.productName.trim().length < 3) {
    deduct(
      "Generic Name",
      "Rule 6(1)(b)",
      "high",
      "Common/generic name of the commodity is missing.",
      15
    );
  }

  // 4. Net quantity & SI units
  const netQtyRegex = /^\d+(\.\d+)?\s*(g|kg|ml|l|m|cm|mm|cm2|m2|number|unit|piece|pair|set|n|u)$/i;
  if (!productData.netQuantityValue || !productData.netQuantityUnit) {
    deduct("Net Quantity", "Rule 6(1)(c) / Rule 11", "high", "Net quantity is not declared.", 15);
  } else {
    const combined = `${productData.netQuantityValue}${productData.netQuantityUnit}`;
    if (!netQtyRegex.test(combined)) {
      violations.push({
        field: "Net Quantity Unit",
        ruleRef: "Rule 13",
        status: "partial",
        severity: "medium",
        description: `Unit '${productData.netQuantityUnit}' is not a recognised SI unit under these rules.`,
        deduction: 5,
      });
      score -= 5;
    }
    if (/minimum|about|approx|not less than|average/i.test(productData.netQuantityText || "")) {
      violations.push({
        field: "Net Quantity Wording",
        ruleRef: "Rule 13(6)",
        status: "violation",
        severity: "medium",
        description: "Net quantity declaration uses a qualifying/exaggerating word which is prohibited.",
        deduction: 5,
      });
      score -= 5;
    }
  }

  // 5. Month & year of manufacture
  const mfgExempt =
    ["bidi", "incense sticks"].includes((productData.category || "").toLowerCase()) ||
    productData.isLpgCylinderPSU;
  if (!mfgExempt && !productData.mfgMonthYear) {
    deduct(
      "Month & Year of Manufacture",
      "Rule 6(1)(d)",
      "medium",
      "Month and year of manufacture is missing.",
      5
    );
  }

  // 6. Best before / use by (only if perishable)
  if (productData.isPerishable && !productData.bestBeforeOrUseBy) {
    deduct(
      "Best Before / Use By",
      "Rule 6(1)(da)",
      "high",
      "Perishable commodity must declare best-before or use-by date.",
      10
    );
  }

  // 7. MRP & inclusive of all taxes
  const mrpStr = productData.mrpString || (productData.retailSalePrice ? `₹${productData.retailSalePrice} (incl. of all taxes)` : "");
  if (!productData.retailSalePrice && !productData.mrpString) {
    deduct(
      "MRP",
      "Rule 6(1)(e)",
      "high",
      'MRP is missing or does not state "inclusive of all taxes" in the required format.',
      20
    );
  } else if (productData.mrpString && !checkMRPFormat(productData.mrpString)) {
    violations.push({
      field: "MRP Format",
      ruleRef: "Rule 6(1)(e)",
      status: "partial",
      severity: "medium",
      description: 'MRP statement must explicitly mention "inclusive of all taxes" / "incl. of all taxes".',
      deduction: 10,
    });
    score -= 10;
  }

  // 8. Consumer care details
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}|1800[\-\s]?\d{3}[\-\s]?\d{3,4}/;
  const cc = productData.consumerCare || "";
  if (!emailRegex.test(cc) || !phoneRegex.test(cc)) {
    deduct(
      "Consumer Care",
      "Rule 6(2)",
      "medium",
      "Consumer care declaration needs BOTH an email and a helpline phone number.",
      10
    );
  }

  // 9. Unit Sale Price (USP)
  if (uspRequired(productData)) {
    if (productData.unitSalePrice == null) {
      deduct("Unit Sale Price", "Rule 6(11)", "medium", "USP is not declared.", 10);
    } else if (productData.retailSalePrice && productData.netQuantityValue && productData.netQuantityUnit) {
      const expected = computeExpectedUSP(
        productData.retailSalePrice,
        productData.netQuantityValue,
        productData.netQuantityUnit
      );
      if (expected && Math.abs(expected.value - productData.unitSalePrice) > 0.02) {
        violations.push({
          field: "Unit Sale Price Accuracy",
          ruleRef: "Rule 6(11)",
          status: "incorrect",
          severity: "medium",
          description: `Declared USP ₹${productData.unitSalePrice}/${expected.per} does not match computed ₹${expected.value}/${expected.per}.`,
          deduction: 8,
        });
        score -= 8;
      }
    }
  }

  return {
    complianceScore: Math.max(0, score),
    isCompliant: score >= 85,
    exempt: false,
    violations,
    passedChecks: rulesConfig.mandatoryFields.length - violations.length,
    totalChecks: rulesConfig.mandatoryFields.length,
  };
}

export { rulesConfig };
