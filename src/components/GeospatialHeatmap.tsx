import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  Building2,
  Search,
  RefreshCw,
  Flame,
  PieChart,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Download,
  Plus,
  Send,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface ViolatedRule {
  rule: string;
  count: number;
}

interface ProductScan {
  id: string;
  productName: string;
  score: number;
  isCompliant: boolean;
  violationsCount: number;
  timestamp: string;
}

interface HubCluster {
  pincode: string;
  locationName: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  totalScans: number;
  compliantScans: number;
  nonCompliantScans: number;
  avgComplianceScore: number;
  defectRate: number;
  violationsCount: number;
  riskLevel: 'red' | 'orange' | 'yellow' | 'green';
  riskLabel: string;
  color: string;
  pulseIntensity: number;
  topViolations: ViolatedRule[];
  categories: string[];
  recentProducts: ProductScan[];
}

interface StateRanking {
  state: string;
  totalScans: number;
  avgScore: number;
  defectRate: number;
  hubsCount: number;
  criticalHubs: number;
}

interface GeospatialKPIs {
  totalScans: number;
  totalViolations: number;
  nationalAvgScore: number;
  criticalHubsCount: number;
  totalTrackedHubs: number;
  defectRatePct: number;
}

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, '') ||
  'http://localhost:3001';

// Available Base Map Tile Providers (100% Free & Watermark-Free)
const MAP_TILES = {
  esri_dark: {
    name: '🌙 Dark Heatmap Mode (Esri Dark)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    subdomains: ''
  },
  osm_standard: {
    name: '📍 OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc'
  },
  osm_hot: {
    name: '🗺️ Vibrant Street Map (OSM HOT)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
    subdomains: 'abc'
  },
  esri_satellite: {
    name: '🛰️ Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    subdomains: ''
  }
};

const GeospatialHeatmap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<GeospatialKPIs | null>(null);
  const [clusters, setClusters] = useState<HubCluster[]>([]);
  const [stateRankings, setStateRankings] = useState<StateRanking[]>([]);
  const [selectedHub, setSelectedHub] = useState<HubCluster | null>(null);

  // Filters & State
  const [tileStyle, setTileStyle] = useState<keyof typeof MAP_TILES>('esri_dark');
  const [timeframe, setTimeframe] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [category, setCategory] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live simulation tester
  const [showTesterModal, setShowTesterModal] = useState(false);
  const [customPin, setCustomPin] = useState('173205');
  const [customScore, setCustomScore] = useState(45);
  const [customProd, setCustomProd] = useState('Generic Skin Cream 50g');
  const [customCategory, setCustomCategory] = useState('Cosmetics');
  const [isSimulating, setIsSimulating] = useState(false);

  // Fetch geospatial data from backend
  const fetchGeoData = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE}/api/analytics/geospatial?timeframe=${timeframe}&category=${encodeURIComponent(
        category
      )}&state=${encodeURIComponent(stateFilter)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKpis(data.kpis || null);
      setClusters(data.clusters || []);
      setStateRankings(data.stateRankings || []);

      if (!selectedHub && data.clusters && data.clusters.length > 0) {
        setSelectedHub(data.clusters[0]);
      }
    } catch (e) {
      console.warn('Geo analytics fetch fallback:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoData();
  }, [timeframe, category, stateFilter]);

  // Filtered clusters based on severity & search
  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      if (severityFilter !== 'all' && c.riskLevel !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.locationName.toLowerCase().includes(q);
        const matchesPin = c.pincode.includes(q);
        const matchesState = c.state.toLowerCase().includes(q);
        const matchesDistrict = c.district.toLowerCase().includes(q);
        return matchesName || matchesPin || matchesState || matchesDistrict;
      }
      return true;
    });
  }, [clusters, severityFilter, searchQuery]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centered on India (approx lat: 21.5, lng: 78.9) with appropriate zoom
    const map = L.map(mapContainerRef.current, {
      center: [21.7679, 78.8718],
      zoom: 5,
      zoomControl: false,
      attributionControl: false
    });

    const tile = L.tileLayer(MAP_TILES[tileStyle].url, {
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(map);

    const layers = L.layerGroup().addTo(map);

    tileLayerRef.current = tile;
    layerGroupRef.current = layers;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Style Layer when changed
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(MAP_TILES[tileStyle].url);
  }, [tileStyle]);

  // Render Real Heatmap Circles & Interactive Pulse Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const layers = layerGroupRef.current;
    layers.clearLayers();

    filteredClusters.forEach((hub) => {
      // 1. Semi-transparent Heat Radius Circle
      const heatRadius =
        hub.riskLevel === 'red' ? 65000 : hub.riskLevel === 'orange' ? 45000 : 30000;
      const heatOpacity = hub.riskLevel === 'red' ? 0.35 : hub.riskLevel === 'orange' ? 0.25 : 0.18;

      const circle = L.circle([hub.lat, hub.lng], {
        radius: heatRadius,
        color: hub.color,
        fillColor: hub.color,
        fillOpacity: heatOpacity,
        weight: hub.riskLevel === 'red' ? 2 : 1,
        dashArray: hub.riskLevel === 'red' ? '4, 4' : undefined
      });

      // 2. Custom Animated HTML Marker Icon
      const customIcon = L.divIcon({
        className: 'custom-heat-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${
              hub.riskLevel === 'red'
                ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: ${hub.color}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                   <div style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: ${hub.color}; opacity: 0.6; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>`
                : hub.riskLevel === 'orange'
                ? `<div style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: ${hub.color}; opacity: 0.35; animation: pulse 2s infinite;"></div>`
                : ''
            }
            <div style="
              position: relative;
              width: ${hub.riskLevel === 'red' ? '30px' : '26px'};
              height: ${hub.riskLevel === 'red' ? '30px' : '26px'};
              border-radius: 9999px;
              background: ${hub.color};
              border: 2px solid #ffffff;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: 11px;
            ">
              ${hub.totalScans}
            </div>
            <div style="
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              margin-top: 4px;
              padding: 2px 6px;
              background: rgba(15, 23, 42, 0.95);
              border: 1px solid rgba(255,255,255,0.2);
              border-radius: 4px;
              color: #ffffff;
              font-size: 10px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            ">
              ${hub.district} (${hub.pincode})
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([hub.lat, hub.lng], { icon: customIcon });

      // Click event on marker
      marker.on('click', () => {
        setSelectedHub(hub);
        mapInstanceRef.current?.flyTo([hub.lat, hub.lng], 8, { duration: 1.2 });
      });

      // Rich popup tooltip on hover
      marker.bindTooltip(
        `
        <div style="padding: 4px 6px; font-family: sans-serif;">
          <div style="font-weight: bold; color: #0f172a; font-size: 12px; margin-bottom: 2px;">
            ${hub.locationName}
          </div>
          <div style="font-size: 11px; color: #475569;">
            PIN: <b>${hub.pincode}</b> • ${hub.state}
          </div>
          <div style="margin-top: 4px; font-size: 11px; font-weight: bold; color: ${hub.color};">
            Score: ${hub.avgComplianceScore}% (${hub.defectRate}% defect rate)
          </div>
        </div>
      `,
        { direction: 'top', offset: [0, -16] }
      );

      layers.addLayer(circle);
      layers.addLayer(marker);
    });
  }, [filteredClusters]);

  // Zoom to hub on card click
  const handleSelectHub = (hub: HubCluster) => {
    setSelectedHub(hub);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([hub.lat, hub.lng], 8, { duration: 1.2 });
    }
  };

  // Reset India View
  const handleResetView = () => {
    mapInstanceRef.current?.flyTo([21.7679, 78.8718], 5, { duration: 1.0 });
  };

  // Zoom in / out
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  // Simulate a live scan for a custom PIN
  const handleSimulateLiveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    try {
      const fd = new FormData();
      const mockText = `Product: ${customProd}\nManufacturer: Pharma Packaging Hub, Industrial Zone, PIN: ${customPin}\nMRP: ₹299\nNet Qty: 100ml\nCategory: ${customCategory}`;
      const mockBlob = new Blob([mockText], { type: 'text/plain' });
      fd.append('image', mockBlob, 'simulate_scan.txt');

      await fetch(`${API_BASE}/api/ocr?provider=tesseract`, {
        method: 'POST',
        body: fd
      }).catch(() => {});

      await fetchGeoData();
      setShowTesterModal(false);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Export Regional Audit Summary
  const exportGeoReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      kpis,
      clusters: filteredClusters,
      stateRankings
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LegalMetrology_Geospatial_Audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400">
            <Flame className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Geospatial Manufacturing Compliance Heatmap
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-full flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live OpenStreetMap Tiles</span>
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Active tracking of Legal Metrology defect rates and non-compliance density across Indian manufacturing PIN codes
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tile Layer Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <select
              value={tileStyle}
              onChange={(e) => setTileStyle(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="esri_dark" className="bg-slate-900 text-white">
                🌙 Dark Heatmap (Esri)
              </option>
              <option value="osm_standard" className="bg-slate-900 text-white">
                📍 OpenStreetMap Standard
              </option>
              <option value="osm_hot" className="bg-slate-900 text-white">
                🗺️ Vibrant Street Map (OSM HOT)
              </option>
              <option value="esri_satellite" className="bg-slate-900 text-white">
                🛰️ Satellite Imagery
              </option>
            </select>
          </div>

          <button
            onClick={() => setShowTesterModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Simulate PIN Audit</span>
          </button>

          <button
            onClick={exportGeoReport}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Report</span>
          </button>

          <button
            onClick={fetchGeoData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tracked Hubs
            </span>
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">
              {kpis?.totalTrackedHubs || clusters.length}
            </span>
            <span className="text-xs text-slate-500">PIN clusters</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Across 12 major industrial belts</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
              Critical Hotspots (🔴)
            </span>
            <Flame className="h-5 w-5 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-red-600">
              {kpis?.criticalHubsCount ?? clusters.filter((c) => c.riskLevel === 'red').length}
            </span>
            <span className="text-xs text-red-500 font-semibold">&lt;60% Compliance</span>
          </div>
          <p className="text-xs text-red-600/80 mt-1">Severe recurring label defects</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              National Avg Score
            </span>
            <PieChart className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span
              className={`text-2xl font-bold ${
                (kpis?.nationalAvgScore || 0) >= 80
                  ? 'text-green-600'
                  : (kpis?.nationalAvgScore || 0) >= 60
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              {kpis?.nationalAvgScore || 0}%
            </span>
            <span className="text-xs text-slate-500">LM Compliance</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Evaluated across all scanned packages</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Package Audits
            </span>
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">
              {kpis?.totalScans || 0}
            </span>
            <span className="text-xs text-rose-500 font-medium">
              {kpis?.defectRatePct || 0}% defect rate
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Geo-tagged from manufacturer labels</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search PIN code, hub name, state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Timeframe Filter */}
          <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-medium">
            {(['all', 'today', '7d', '30d'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  timeframe === t ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                {t === 'all' ? 'All' : t === 'today' ? 'Today' : t}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 font-medium">Risk:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Levels</option>
              <option value="red">🔴 Critical (&lt;60%)</option>
              <option value="orange">🟠 High Risk</option>
              <option value="yellow">🟡 Moderate</option>
              <option value="green">🟢 Compliant</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 font-medium">Industry:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Industries</option>
              <option value="Pharma">Pharmaceuticals</option>
              <option value="Cosmetics">Cosmetics & Personal Care</option>
              <option value="Food">Packaged Food & FMCG</option>
              <option value="Textiles">Textiles & Apparel</option>
              <option value="Electronics">Electronics</option>
              <option value="Edible Oils">Edible Oils</option>
            </select>
          </div>

          {/* State Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 font-medium">State:</span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All States</option>
              {stateRankings.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({s.avgScore}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Real Map + Location Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Real Leaflet Map Container (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
          {/* Map Top Bar with Quick Controls */}
          <div className="p-3.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-white z-10 relative">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Interactive Geospatial Heatmap — India Manufacturing Hubs
              </span>
            </div>

            {/* In-Map Controls */}
            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-700 text-slate-300 rounded"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-700 text-slate-300 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={handleResetView}
                className="p-1 hover:bg-slate-700 text-slate-300 rounded flex items-center space-x-1 px-1.5 text-[11px]"
                title="Reset View"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>India</span>
              </button>
            </div>
          </div>

          {/* Actual Leaflet Map Canvas */}
          <div
            ref={mapContainerRef}
            className="w-full h-[540px] z-0 bg-slate-950"
            style={{ minHeight: '540px' }}
          />

          {/* Map Footer Legend */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-red-400 font-semibold">Critical Non-Compliance (&lt;60%)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-orange-400 font-semibold">High Risk (60-74%)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-yellow-400 font-semibold">Moderate (75-84%)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-semibold">Compliant (&ge;85%)</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Click any marker to inspect cluster details</span>
          </div>
        </div>

        {/* Location Inspector Drawer (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {selectedHub ? (
            <div>
              {/* Header */}
              <div
                className="p-5 text-white"
                style={{
                  background:
                    selectedHub.riskLevel === 'red'
                      ? 'linear-gradient(135deg, #991b1b, #ef4444)'
                      : selectedHub.riskLevel === 'orange'
                      ? 'linear-gradient(135deg, #c2410c, #f97316)'
                      : selectedHub.riskLevel === 'yellow'
                      ? 'linear-gradient(135deg, #854d0e, #eab308)'
                      : 'linear-gradient(135deg, #065f46, #10b981)'
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-wider font-semibold opacity-90">
                        PIN: {selectedHub.pincode} • {selectedHub.state}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold mt-1">{selectedHub.locationName}</h2>
                    <p className="text-xs opacity-90 mt-0.5">
                      {selectedHub.district} District Industrial Cluster
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-black">{selectedHub.avgComplianceScore}%</div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                      Compliance Score
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                {/* Risk Level Badge */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    selectedHub.riskLevel === 'red'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : selectedHub.riskLevel === 'orange'
                      ? 'bg-orange-50 border-orange-200 text-orange-800'
                      : selectedHub.riskLevel === 'yellow'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="font-semibold">{selectedHub.riskLabel}</span>
                  </div>
                  <span className="font-bold">{selectedHub.defectRate}% Defect Rate</span>
                </div>

                {/* Audit Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="text-slate-500 font-medium">Audited</div>
                    <div className="text-base font-bold text-slate-800">{selectedHub.totalScans}</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <div className="text-emerald-600 font-medium">Compliant</div>
                    <div className="text-base font-bold text-emerald-700">{selectedHub.compliantScans}</div>
                  </div>
                  <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg">
                    <div className="text-red-600 font-medium">Violations</div>
                    <div className="text-base font-bold text-red-700">{selectedHub.violationsCount}</div>
                  </div>
                </div>

                {/* Top Violated Legal Metrology Rules */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span>Top Violated Legal Metrology Rules in this Hub</span>
                  </h3>
                  {selectedHub.topViolations && selectedHub.topViolations.length > 0 ? (
                    <div className="space-y-2">
                      {selectedHub.topViolations.map((v, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs"
                        >
                          <span className="font-medium text-slate-700">{v.rule}</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded-md">
                            {v.count} violations
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Zero recurring violations recorded in this manufacturing cluster.</span>
                    </div>
                  )}
                </div>

                {/* Recent Products Audited in this Hub */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Recent Scanned Products from this Hub</span>
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedHub.recentProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg text-xs hover:bg-slate-50 transition"
                      >
                        <div className="truncate max-w-[200px]">
                          <p className="font-semibold text-slate-800 truncate">{p.productName}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(p.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.isCompliant
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {p.score}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Industries Active */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Manufacturing Categories:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedHub.categories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <MapPin className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold">Select a manufacturing hub on the map to inspect</p>
            </div>
          )}
        </div>
      </div>

      {/* Non-Compliant Hubs Leaderboard & State Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hubs Ranking Leaderboard */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Flame className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-bold text-slate-900">
                Non-Compliant Manufacturing Hubs Leaderboard
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">Ranked by Defect Rate</span>
          </div>

          <div className="space-y-2.5">
            {clusters.slice(0, 5).map((hub, idx) => (
              <div
                key={hub.pincode}
                onClick={() => handleSelectHub(hub)}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  selectedHub?.pincode === hub.pincode
                    ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-200'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black ${
                      idx === 0
                        ? 'bg-red-600 text-white'
                        : idx === 1
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800">{hub.locationName}</h4>
                    <p className="text-xs text-slate-500">
                      PIN {hub.pincode} • {hub.district}, {hub.state}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: hub.color }}
                  >
                    {hub.avgComplianceScore}% Score
                  </span>
                  <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                    {hub.defectRate}% defect rate
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* State-Level Compliance Performance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                State-Level Compliance Distribution
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">Average Compliance Score</span>
          </div>

          <div className="space-y-3">
            {stateRankings.map((st) => (
              <div key={st.state} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>{st.state}</span>
                  <span className="font-bold text-slate-900">{st.avgScore}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${st.avgScore}%`,
                      backgroundColor:
                        st.avgScore < 60
                          ? '#EF4444'
                          : st.avgScore < 75
                          ? '#F97316'
                          : st.avgScore < 85
                          ? '#EAB308'
                          : '#10B981'
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{st.hubsCount} Industrial Hubs Tracked</span>
                  <span className="text-red-500 font-medium">
                    {st.criticalHubs > 0 ? `${st.criticalHubs} Critical Hotspots` : 'Compliant'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulate Live PIN Audit Modal */}
      {showTesterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Simulate Live Packaging Audit</h3>
              </div>
              <button
                onClick={() => setShowTesterModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateLiveAudit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Indian 6-Digit PIN Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 173205, 395001, 110020"
                  value={customPin}
                  onChange={(e) => setCustomPin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={customProd}
                  onChange={(e) => setCustomProd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Industry Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="Cosmetics">Cosmetics</option>
                    <option value="Pharma">Pharmaceuticals</option>
                    <option value="Food">Packaged Food</option>
                    <option value="Textiles">Textiles</option>
                    <option value="Edible Oils">Edible Oils</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Compliance Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customScore}
                    onChange={(e) => setCustomScore(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTesterModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center space-x-1.5"
                >
                  {isSimulating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Inject & Update Heatmap</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeospatialHeatmap;
