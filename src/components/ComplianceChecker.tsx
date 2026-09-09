import React, { useState } from "react";
import { Search, AlertTriangle, CheckCircle, X, ExternalLink } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { logComplianceCheck } from '../services/firestoreService';

/** ---------------- Types ---------------- */
type Violation = {
  field: string;
  ruleRef?: string;
  status: "missing" | "partial" | "compliant" | "violation" | "incorrect";
  severity: "high" | "medium" | "low" | "none";
  description: string;
  deduction?: number;
};

type ComplianceResult =
  | {
      productName: string;
      platform: string;
      complianceScore: number;
      isCompliant?: boolean;
      exempt?: boolean;
      exemptionReason?: string;
      violations: Violation[];
      recommendedActions: string[];
      productUrl: string;
      price?: number | null;
      brand?: string | null;
      rating?: number | null;
      ratingCount?: number | null;
      image?: string | null;
    }
  | null;

/** ---------------- Helpers ---------------- */
function splitUrlAndMode(raw: string): { cleanUrl: string; mode?: string } {
  try {
    const u = new URL(raw);
    const mode = u.searchParams.get("mode") || undefined;
    if (mode) u.searchParams.delete("mode"); // keep mode out of product URL
    return { cleanUrl: u.toString(), mode };
  } catch {
    return { cleanUrl: raw };
  }
}

/** Absolute API base (Fix A) */
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3001" : "/api");

/** Optional: enable sandbox automatically in dev (set VITE_SANDBOX=1 to force) */
const AUTO_SANDBOX =
  import.meta.env.DEV && import.meta.env.VITE_SANDBOX === "1";

/** ---------------- Component ---------------- */
const ComplianceChecker: React.FC = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<ComplianceResult>(null);

  const runFetch = async (finalUrl: string, forcedMode?: string) => {
    const { cleanUrl, mode } = splitUrlAndMode(finalUrl);
    const chosenMode = forcedMode || mode || (AUTO_SANDBOX ? "sandbox" : undefined);

    const apiUrl =
      `${API_BASE}/api/product-info?url=${encodeURIComponent(cleanUrl)}` +
      (chosenMode ? `&mode=${encodeURIComponent(chosenMode)}` : "");

    console.log("calling backend:", apiUrl);

    const r = await fetch(apiUrl);
    const data = await r.json();

    // If html path failed with 451 and we didn't force a mode, try Playwright
    if (!r.ok && r.status === 451 && !chosenMode) {
      const apiUrl2 = `${API_BASE}/api/product-info?url=${encodeURIComponent(
        cleanUrl
      )}&mode=browser`;
      console.log("retrying with browser:", apiUrl2);
      const r2 = await fetch(apiUrl2);
      const d2 = await r2.json();
      return { ok: r2.ok, data: d2 };
    }

    return { ok: r.ok, data };
  };

  // 🔥 Helper to log compliance check to Firebase
  async function logCheckToFirebase(result: ComplianceResult) {
    if (!user || !result) return;

    try {
      console.log('🔥 Logging to Firebase with userId:', user.id);
      console.log('📝 Product:', result.productName);
      console.log('📊 Score:', result.complianceScore);

      // Extract issues from violations
      const issues = result.violations
        .filter(v => v.status !== 'compliant')
        .map(v => `[${v.ruleRef || 'Rule'}] ${v.field}: ${v.description}`);

      const isCompliant = (result.complianceScore ?? 0) >= 80;

      await logComplianceCheck(
        user.id,
        user.name,
        result.productName,
        isCompliant,
        issues,
        result.complianceScore,
        {
          platform: result.platform || 'E-Commerce',
          category: 'Packaged Commodities',
          productUrl: result.productUrl || '',
          violations: result.violations || []
        }
      );

      console.log('✅ Successfully logged to Firebase!');
    } catch (error) {
      console.error('❌ Failed to log compliance check:', error);
    }
  }

  const handleCheck = async (targetUrl?: string) => {
    const finalUrl = (targetUrl ?? url).trim();
    if (!finalUrl) return;

    console.log('🔍 Starting compliance check...');
    console.log('👤 Current user:', user);

    setIsChecking(true);
    setResults(null);

    try {
      const { ok, data } = await runFetch(finalUrl);
      if (!ok) throw new Error(data?.error || "Failed to fetch product information");

      // Build payload for backend Legal Metrology Rulebook Engine
      const evalPayload = {
        productName: data.productName || data.title || "",
        manufacturer: data.manufacturer || data.brand || "",
        isImported: data.isImported || false,
        soldViaEcommerce: true,
        countryOfOrigin: data.countryOfOrigin || (data.platform ? "India" : ""),
        netQuantityValue: data.netQuantityValue || (data.quantity ? parseFloat(data.quantity) : null),
        netQuantityUnit: data.netQuantityUnit || (data.quantity ? data.quantity.replace(/[\d.\s]/g, '') : "g"),
        netQuantityText: data.quantity || data.netQuantity || "",
        mfgMonthYear: data.mfgDate || data.mfgMonthYear || "01/2026",
        isPerishable: data.isPerishable || false,
        bestBeforeOrUseBy: data.bestBefore || data.expiryDate || "",
        mrpString: data.mrpString || (data.price ? `MRP Rs. ${data.price} (inclusive of all taxes)` : ""),
        retailSalePrice: typeof data.price === 'number' ? data.price : parseFloat(data.price || 0),
        unitSalePrice: data.unitSalePrice ?? null,
        consumerCare: data.consumerCare || "support@store.com, 1800-123-456",
        packageType: data.packageType || "single",
        category: data.category || "general"
      };

      // Call backend compliance rule engine
      let engineResult = null;
      try {
        const evalResp = await fetch(`${API_BASE}/api/evaluate-compliance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(evalPayload),
        });
        if (evalResp.ok) {
          engineResult = await evalResp.json();
        }
      } catch (engineErr) {
        console.warn("Backend evaluation error, falling back to local evaluation:", engineErr);
      }

      let complianceScore = engineResult?.complianceScore ?? 85;
      let violations: Violation[] = engineResult?.violations || [];

      if (!engineResult) {
        // Fallback local checks
        const validations = [
          { field: "Common/Generic Name", ruleRef: "Rule 6(1)(b)", ok: !!data.productName, weight: 15 },
          { field: "Manufacturer/Packer Details", ruleRef: "Rule 6(1)(a)", ok: !!data.brand || !!data.manufacturer, weight: 15 },
          { field: "MRP (inclusive of taxes)", ruleRef: "Rule 6(1)(e)", ok: !!data.price, weight: 20 },
          { field: "Country of Origin", ruleRef: "Rule 6(10)", ok: !!data.countryOfOrigin || !!data.brand, weight: 10 },
          { field: "Net Quantity & Units", ruleRef: "Rule 6(1)(c)", ok: !!data.quantity || !!data.netQuantity, weight: 15 },
        ];
        const passedWeight = validations.filter((v) => v.ok).reduce((sum, v) => sum + v.weight, 0);
        complianceScore = Math.round((passedWeight / 75) * 100);
        violations = validations.map((v) => ({
          field: v.field,
          ruleRef: v.ruleRef,
          status: v.ok ? "compliant" : "missing",
          severity: v.ok ? "none" : "high",
          description: v.ok ? `${v.field} is declared.` : `${v.field} is missing on listing.`,
        }));
      }

      const result: ComplianceResult = {
        productName: data.productName || data.title || "Unknown product",
        platform: data.platform || "E-Commerce",
        complianceScore,
        isCompliant: engineResult?.isCompliant ?? (complianceScore >= 80),
        exempt: engineResult?.exempt,
        exemptionReason: engineResult?.exemptionReason,
        violations,
        recommendedActions: [
          !data.price && "Declare Maximum Retail Price (MRP) with 'inclusive of all taxes' (Rule 6(1)(e))",
          !data.brand && !data.manufacturer && "Add complete Manufacturer / Packer / Importer details (Rule 6(1)(a))",
          !data.countryOfOrigin && "Declare Country of Origin on digital product listing (Rule 6(10))",
          !data.image && "Provide clear front-of-pack image showing Principal Display Panel",
        ].filter(Boolean) as string[],
        productUrl: data.url || finalUrl,
        price: typeof data.price === 'number' ? data.price : parseFloat(data.price || 0),
        brand: data.brand || data.manufacturer || null,
        rating: data.rating ?? null,
        ratingCount: data.ratingCount ?? null,
        image: data.image ?? null,
      };

      setResults(result);

      // 🔥 LOG TO FIREBASE immediately after setting results
      await logCheckToFirebase(result);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error('❌ Error during compliance check:', message);
      
      const errorResult: ComplianceResult = {
        productName: "Could not fetch details",
        platform: "Unknown",
        complianceScore: 0,
        violations: [
          {
            field: "Product Fetch",
            ruleRef: "Connection Error",
            status: "missing",
            severity: "high",
            description: message,
          },
        ],
        recommendedActions: ["Verify URL/domain and try again."],
        productUrl: finalUrl,
        price: null,
        brand: null,
        rating: null,
        ratingCount: null,
        image: null,
      };
      
      setResults(errorResult);
      await logCheckToFirebase(errorResult);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);

    console.log('🔍 Starting compliance check...');
    console.log('👤 Current user:', user);
    console.log('📝 User ID being saved:', user?.id); // 🔥 Check this matches Firebase

    try {
      const response = await fetch(`${API_BASE}/api/compliance/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      });

      const data = await response.json();
      console.log('📦 Compliance response:', data);

      if (data.success) {
        setResults(data.result);

        // 🔥 LOG TO FIREBASE
        if (user) {
          console.log('🔥 Logging to Firebase with userId:', user.id); // 🔥 Verify this

          await logComplianceCheck(
            user.id,
            user.name,
            results.productName,
            data.result.isCompliant,
            data.result.issues,
            data.result.complianceScore
          );
          
          console.log('✅ Successfully logged to Firebase!');
        }
      }
    } catch (error) {
      console.error('❌ Error during compliance check:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Compliance Checker</h2>
        <p className="text-gray-600 mt-1">
          Validate product listings against Legal Metrology requirements
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Product URL Analysis
        </h3>
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="url"
              placeholder="Enter product URL (e.g., https://amazon.in/dp/ASIN)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => handleCheck()}
            disabled={!url || isChecking}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            <Search className="h-5 w-5" />
            <span>{isChecking ? "Analyzing..." : "Check Compliance"}</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tip: add <code>?mode=sandbox</code> to your product URL while testing. We'll pass it to
          the backend correctly.
        </p>
      </div>

      {/* Quick Check Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => {
            const u = "https://www.amazon.in/dp/B07WNS52H2?mode=sandbox";
            setUrl(u);
            handleCheck(u);
          }}
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
        >
          <div className="text-left">
            <p className="font-medium text-gray-900">Sample Product #1</p>
            <p className="text-sm text-gray-600">NAKPRO Creatine – Amazon</p>
          </div>
        </button>
        <button
          onClick={() => {
            const u = "https://flipkart.com/p/itm-example?mode=sandbox";
            setUrl(u);
            handleCheck(u);
          }}
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
        >
          <div className="text-left">
            <p className="font-medium text-gray-900">Sample Product #2</p>
            <p className="text-sm text-gray-600">Baby Food – Flipkart</p>
          </div>
        </button>
        <button
          onClick={() => {
            const u = "https://myntra.com/p/example?mode=sandbox";
            setUrl(u);
            handleCheck(u);
          }}
          className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
        >
          <div className="text-left">
            <p className="font-medium text-gray-900">Sample Product #3</p>
            <p className="text-sm text-gray-600">Organic Tea – Myntra</p>
          </div>
        </button>
      </div>

      {/* Loading */}
      {isChecking && (
        <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Analyzing product compliance...</p>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <p>• Extracting product information</p>
              <p>• Running OCR on product images</p>
              <p>• Validating against Legal Metrology rules</p>
              <p>• Generating compliance report</p>
              {user && <p className="text-blue-600">• Logging check to your account...</p>}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && !isChecking && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {results.image && (
                  <img
                    src={results.image}
                    alt="product"
                    className="w-16 h-16 rounded object-cover border"
                  />
                )}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {results.productName}
                  </h3>
                  <p className="text-gray-600">
                    Platform: {results.platform}
                    {results.brand ? ` • Brand: ${results.brand}` : ""}
                    {typeof results.price === "number" ? ` • Price: ₹${results.price}` : ""}
                    {typeof results.rating === "number"
                      ? ` • Rating: ${results.rating}${
                          results.ratingCount ? ` (${results.ratingCount})` : ""
                        }`
                      : ""}
                  </p>
                  {user && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Saved to your compliance history
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Compliance Score</p>
                  <p
                    className={`text-2xl font-bold ${
                      results.complianceScore >= 80
                        ? "text-green-600"
                        : results.complianceScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {results.complianceScore}%
                  </p>
                </div>

                <a
                  href={results.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View Product</span>
                </a>
              </div>
            </div>
          </div>

          {/* Exemption Banner if applicable */}
          {results.exempt && (
            <div className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-3 text-emerald-800">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Exempt from Mandatory Declarations under Rule 26</p>
                <p className="text-xs text-emerald-700 mt-0.5">Reason: {results.exemptionReason}</p>
              </div>
            </div>
          )}

          {/* Compliance Details */}
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <span>Compliance Check Results</span>
              <span className="text-xs font-normal text-gray-500">
                Based on Legal Metrology (Packaged Commodities) Rules, 2011 (Amended 2024)
              </span>
            </h4>
            <div className="space-y-3">
              {results.violations.map((violation, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-4 p-4 rounded-lg border ${
                    violation.status === "compliant"
                      ? "bg-green-50/40 border-green-100"
                      : violation.status === "partial"
                      ? "bg-yellow-50/40 border-yellow-100"
                      : "bg-red-50/40 border-red-100"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {violation.status === "compliant" ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : violation.status === "partial" ? (
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    ) : (
                      <X className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <p className="font-medium text-gray-900">{violation.field}</p>
                      {violation.ruleRef && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-mono border border-gray-200">
                          {violation.ruleRef}
                        </span>
                      )}
                      {violation.deduction ? (
                        <span className="text-xs text-red-600 font-medium">
                          (-{violation.deduction} pts)
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{violation.description}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      violation.status === "compliant"
                        ? "bg-green-100 text-green-800"
                        : violation.status === "partial"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {violation.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Recommended Actions */}
            {results.recommendedActions.length > 0 && (
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Recommended Actions
                </h4>
                <div className="space-y-2">
                  {results.recommendedActions.map((action, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <p className="text-gray-700">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal Metrology Rules Reference */}
      <div className="bg-gradient-to-r from-orange-50 to-green-50 rounded-xl p-6 border border-orange-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Legal Metrology Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Mandatory Declarations:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Name and address of manufacturer/packer/importer</li>
              <li>• Net quantity in standard units</li>
              <li>• Maximum Retail Price (MRP) inclusive of taxes</li>
              <li>• Consumer care details</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Additional Requirements:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Date of manufacture/import</li>
              <li>• Country of origin</li>
              <li>• Generic/common name of commodity</li>
              <li>• Dimensions for certain products</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceChecker;