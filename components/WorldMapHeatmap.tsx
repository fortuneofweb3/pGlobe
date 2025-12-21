'use client';

import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import { formatStorageBytes } from '@/lib/utils/storage';
import { WORLD_MAP_PATHS } from '@/lib/data/world-map-paths';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Info } from 'lucide-react';

interface CountryData {
  name: string;
  count: number;
  storage: number;
  onlineCount: number;
  avgLatency: number | null;
}

interface WorldMapHeatmapProps {
  nodes: PNode[];
}

// Helper function to parse SVG path and extract bounding box
const getPathBounds = (path: string): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  // Extract all coordinate pairs from the path (handles M, L, C, Q, Z commands)
  // Match numbers (including negative) that appear as coordinate pairs
  const numbers = path.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!numbers || numbers.length < 2) return null;

  const coords = numbers.map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Process coordinate pairs (x, y)
  for (let i = 0; i < coords.length; i += 2) {
    if (i + 1 < coords.length) {
      const x = coords[i];
      const y = coords[i + 1];
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
};

// Countries to exclude from viewBox calculation (polar regions, small territories)
const EXCLUDED_COUNTRIES = new Set([
  'French Southern and Antarctic Lands',
  'Antarctica',
  // Add other polar/remote territories if needed
]);

// Helper function to normalize country names (map node country names to map path names)
const normalizeCountryName = (countryName: string): string => {
  if (!countryName) return 'Unknown';
  
  const countryNameMap: Record<string, string> = {
    'United States': 'United States of America',
    'USA': 'United States of America',
    'US': 'United States of America',
    'United Kingdom': 'United Kingdom',
    'UK': 'United Kingdom',
    'Great Britain': 'United Kingdom',
    // Add other common variations as needed
  };

  // Check exact match first
  if (countryNameMap[countryName]) {
    return countryNameMap[countryName];
  }

  // Check case-insensitive match in map
  const lowerName = countryName.toLowerCase();
  for (const [key, value] of Object.entries(countryNameMap)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Return as-is and let the map matching handle it (case-insensitive)
  return countryName;
};

// Helper function to get country flag emoji
const getCountryFlag = (countryName: string): string => {
  const countryToCode: Record<string, string> = {
    'United States': 'US', 'United States of America': 'US', 'Canada': 'CA', 'United Kingdom': 'GB', 'Germany': 'DE',
    'France': 'FR', 'Italy': 'IT', 'Spain': 'ES', 'Netherlands': 'NL', 'Belgium': 'BE',
    'Switzerland': 'CH', 'Austria': 'AT', 'Poland': 'PL', 'Sweden': 'SE', 'Norway': 'NO',
    'Denmark': 'DK', 'Finland': 'FI', 'Ireland': 'IE', 'Portugal': 'PT', 'Greece': 'GR',
    'Czech Republic': 'CZ', 'Romania': 'RO', 'Hungary': 'HU', 'Bulgaria': 'BG',
    'Australia': 'AU', 'New Zealand': 'NZ', 'Japan': 'JP', 'South Korea': 'KR',
    'China': 'CN', 'India': 'IN', 'Singapore': 'SG', 'Hong Kong': 'HK', 'Taiwan': 'TW',
    'Thailand': 'TH', 'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY',
    'Philippines': 'PH', 'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Mexico': 'MX',
    'Colombia': 'CO', 'Peru': 'PE', 'South Africa': 'ZA', 'Egypt': 'EG', 'Israel': 'IL',
    'Turkey': 'TR', 'United Arab Emirates': 'AE', 'Saudi Arabia': 'SA', 'Russia': 'RU',
    'Ukraine': 'UA', 'Iceland': 'IS', 'Luxembourg': 'LU', 'Estonia': 'EE', 'Latvia': 'LV',
    'Lithuania': 'LT', 'Slovenia': 'SI', 'Croatia': 'HR', 'Serbia': 'RS', 'Slovakia': 'SK',
    'Nigeria': 'NG',
  };

  const code = countryToCode[countryName];
  if (!code) return '';

  // Convert country code to flag emoji
  return String.fromCodePoint(
    ...code.split('').map(char => 127397 + char.charCodeAt(0))
  );
};

const WorldMapHeatmap = ({ nodes }: WorldMapHeatmapProps) => {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  
  // Pan and zoom state for mobile
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Aggregate nodes by country (filter out invalid nodes)
  // First, create a map of normalized country names from map paths for case-insensitive matching
  const mapCountryNames = useMemo(() => {
    const names = new Set<string>();
    WORLD_MAP_PATHS.forEach(({ name }) => {
      names.add(name.toLowerCase());
    });
    return names;
  }, []);

  // Helper to find matching map country name (case-insensitive)
  const findMapCountryName = (nodeCountry: string): string | null => {
    const normalized = normalizeCountryName(nodeCountry);
    const lowerNormalized = normalized.toLowerCase();
    
    // Check if normalized name exists in map paths (case-insensitive)
    for (const mapPath of WORLD_MAP_PATHS) {
      if (mapPath.name.toLowerCase() === lowerNormalized) {
        return mapPath.name; // Return the exact map path name
      }
    }
    
    return null;
  };

  const countryData = nodes
    .reduce((acc, node) => {
      const rawCountry = node.locationData?.country || 'Unknown';
      const normalized = normalizeCountryName(rawCountry);
      // Find the exact map path country name (case-insensitive match)
      const mapCountryName = findMapCountryName(normalized) || normalized;
      
      if (!acc[mapCountryName]) {
        acc[mapCountryName] = {
          name: mapCountryName,
          count: 0,
          storage: 0,
          onlineCount: 0,
          avgLatency: null,
          latencies: [],
        };
      }
      acc[mapCountryName].count += 1;
      acc[mapCountryName].storage += node.storageCapacity || 0;
      if (node.status === 'online') {
        acc[mapCountryName].onlineCount += 1;
      }
      if (node.latency && node.latency > 0) {
        (acc[mapCountryName] as any).latencies.push(node.latency);
      }
      return acc;
    }, {} as Record<string, CountryData & { latencies: number[] }>);

  // Calculate average latency for each country
  Object.keys(countryData).forEach((country) => {
    const data = countryData[country] as any;
    if (data.latencies.length > 0) {
      data.avgLatency = Math.round(
        data.latencies.reduce((sum: number, lat: number) => sum + lat, 0) / data.latencies.length
      );
    }
    delete data.latencies;
  });

  // Get max node count for color scaling
  const maxCount = Math.max(...Object.values(countryData).map((d) => d.count), 1);

  // Get top countries by node count
  const topCountries = useMemo(() => {
    return Object.values(countryData)
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [countryData]);

  // Calculate dynamic viewBox based on all land countries (excluding polar regions)
  const viewBox = useMemo(() => {
    // Get all countries except excluded ones and filter to land countries only
    // Calculate bounds from all visible countries to ensure proper fit
    const visibleCountries = WORLD_MAP_PATHS.filter(
      country => !EXCLUDED_COUNTRIES.has(country.name)
    );

    // Calculate bounding box of all visible countries
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visibleCountries.forEach(({ path }) => {
      const bounds = getPathBounds(path);
      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    });

    // If no valid bounds found, use default
    if (minX === Infinity) {
      return '-40 -20 880 440';
    }

    // Calculate dimensions
    const width = maxX - minX;
    const height = maxY - minY;

    // Add small padding (1%) to ensure all lands are visible
    const padding = 0.01;
    const paddingX = width * padding;
    const paddingY = height * padding;
    
    // Return viewBox with padding to fit all lands exactly
    return `${minX - paddingX} ${minY - paddingY} ${width + paddingX * 2} ${height + paddingY * 2}`;
  }, []);

  // Calculate mobile-optimized viewBox (more zoomed in)
  const mobileViewBox = useMemo(() => {
    const visibleCountries = WORLD_MAP_PATHS.filter(
      country => !EXCLUDED_COUNTRIES.has(country.name)
    );

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visibleCountries.forEach(({ path }) => {
      const bounds = getPathBounds(path);
      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    });

    if (minX === Infinity) {
      return '-40 -20 880 440';
    }

    const width = maxX - minX;
    const height = maxY - minY;
    
    // Zoom in more for mobile (reduce viewBox by 50% = 2x zoom)
    const zoomFactor = 0.5;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const zoomedWidth = width * zoomFactor;
    const zoomedHeight = height * zoomFactor;
    const zoomedMinX = centerX - zoomedWidth / 2;
    const zoomedMinY = centerY - zoomedHeight / 2;

    return `${zoomedMinX} ${zoomedMinY} ${zoomedWidth} ${zoomedHeight}`;
  }, []);

  // Pan and zoom handlers for mobile
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMobile) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMobile || !isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    if (!isMobile) return;
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isMobile) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistanceRef.current = distance;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isMobile) return;
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (lastTouchDistanceRef.current !== null) {
        const scale = distance / lastTouchDistanceRef.current;
        setZoom(prev => Math.max(0.5, Math.min(3, prev * scale)));
      }
      lastTouchDistanceRef.current = distance;
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    setIsDragging(false);
    lastTouchDistanceRef.current = null;
  };

  // Helper function to lighten a hex color
  const lightenColor = (hex: string, percent: number): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse RGB
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    
    // Lighten each component
    const newR = Math.min(255, Math.round(r + (255 - r) * percent));
    const newG = Math.min(255, Math.round(g + (255 - g) * percent));
    const newB = Math.min(255, Math.round(b + (255 - b) * percent));
    
    // Convert back to hex
    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
  };

  // Color scale function - fire gradient (dark red → orange → yellow)
  const getColor = (count: number) => {
    if (count === 0) return '#34363A'; // Muted dark gray for lands without nodes
    const intensity = Math.min(count / maxCount, 1);

    // Fire gradient: dark red → red → orange → bright orange/yellow
    if (intensity < 0.2) return '#7f1d1d'; // red-950 - dark embers
    if (intensity < 0.4) return '#dc2626'; // red-600 - red fire
    if (intensity < 0.6) return '#ea580c'; // orange-600 - orange fire
    if (intensity < 0.8) return '#f97316'; // orange-500 - bright orange
    return '#fb923c'; // orange-400 - hot flame
  };

  const handleCountryClick = (countryName: string) => {
    const data = countryData[countryName];
    if (data && data.count > 0) {
      router.push(`/regions/${encodeURIComponent(countryName)}`);
    }
  };

  const handlePathMouseEnter = (e: React.MouseEvent<SVGPathElement>, tooltipText: string) => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    // Show tooltip at mouse position
    setTooltip({
      text: tooltipText,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handlePathMouseMove = (e: React.MouseEvent<SVGPathElement>, tooltipText: string) => {
    // Update tooltip position to follow mouse
    setTooltip({
      text: tooltipText,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handlePathMouseLeave = () => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltip(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_280px] h-[350px] sm:h-[400px] lg:h-[500px]">
        {/* Map - Left Column */}
        <div className="relative w-full flex-1 lg:flex-none overflow-hidden" style={{ margin: 0, padding: 0 }}>
          <svg
            ref={svgRef}
            viewBox={isMobile ? mobileViewBox : viewBox}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            style={{ 
              pointerEvents: 'auto', 
              display: 'block', 
              margin: 0, 
              padding: 0,
              width: '100%',
              height: '100%',
              verticalAlign: 'top',
              cursor: isMobile && isDragging ? 'grabbing' : isMobile ? 'grab' : 'default',
              touchAction: isMobile ? 'none' : 'auto',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Shadow filter definition */}
            <defs>
              <filter id="landShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.4" floodColor="#000000" />
              </filter>
            </defs>
            
            {/* Country paths */}
            <g 
              style={{ 
                margin: 0, 
                padding: 0,
                transform: isMobile ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : 'none',
                transformOrigin: 'center center',
                filter: 'url(#landShadow)',
              }}
            >
              {WORLD_MAP_PATHS.map((country, index) => {
                // Skip excluded countries (polar regions)
                if (EXCLUDED_COUNTRIES.has(country.name)) {
                  return null;
                }

                const data = countryData[country.name];
                const nodeCount = data?.count || 0;
                const fillColor = getColor(nodeCount);
                const hoverColor = nodeCount > 0 ? lightenColor(fillColor, 0.3) : '#3f4145'; // Slightly lighter on hover
                const flag = getCountryFlag(country.name);
                const tooltipText = `${flag ? flag + ' ' : ''}${country.name}${nodeCount > 0 ? ` - ${nodeCount} nodes` : ''}`;

                return (
                  <path
                    key={index}
                    d={country.path}
                    fill={fillColor}
                    stroke="#555555"
                    strokeWidth="0.5"
                    style={{ 
                      pointerEvents: 'auto',
                      transition: 'fill 0.15s ease',
                    }}
                    className={nodeCount > 0 ? 'cursor-pointer' : ''}
                    onMouseEnter={(e) => {
                      e.currentTarget.setAttribute('fill', hoverColor);
                      handlePathMouseEnter(e, tooltipText);
                    }}
                    onMouseMove={(e) => {
                      handlePathMouseMove(e, tooltipText);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.setAttribute('fill', fillColor);
                      handlePathMouseLeave();
                    }}
                    onClick={() => handleCountryClick(country.name)}
                  />
                );
              })}
            </g>
          </svg>
          
          {/* Custom tooltip portal */}
          {tooltip && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed px-3 py-1.5 text-xs border border-white/20 rounded-lg shadow-xl pointer-events-none z-[10000] whitespace-nowrap"
              style={{
                left: `${tooltip.x + 12}px`,
                top: `${tooltip.y - 8}px`,
                transform: 'translateY(-100%)',
                backgroundColor: '#131313',
                color: '#E0E0E0',
                transition: 'opacity 0.1s ease',
              }}
            >
              {tooltip.text}
            </div>,
            document.body
          )}
        </div>

        {/* Mobile: Collapsible Info Button */}
        <button
          onClick={() => setMobileInfoOpen(!mobileInfoOpen)}
          className="lg:hidden w-full px-4 py-3 bg-muted/40 border-t border-border/60 flex items-center justify-between hover:bg-muted/50 active:bg-muted/60 transition-colors touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-foreground/70" />
            <span className="text-sm font-semibold text-foreground">Heat Map Info</span>
          </div>
          {mobileInfoOpen ? (
            <ChevronDown className="w-4 h-4 text-foreground/70" />
          ) : (
            <ChevronUp className="w-4 h-4 text-foreground/70" />
          )}
        </button>

        {/* Legend/Info - Right Column / Mobile Collapsible */}
        <div className={`w-full lg:w-auto h-full border-t lg:border-t-0 lg:border-l border-border/60 flex flex-col gap-3 lg:gap-4 justify-between overflow-y-auto lg:overflow-hidden transition-all duration-300 ${
          mobileInfoOpen 
            ? 'max-h-[35vh] opacity-100 p-3 lg:p-5' 
            : 'max-h-0 opacity-0 p-0 lg:max-h-full lg:opacity-100 lg:p-5'
        }`}>
          <div className="flex flex-col gap-2 lg:gap-4">
            {/* Header */}
            <div>
              <h3 className="text-sm lg:text-base font-semibold text-foreground mb-0.5 lg:mb-1">Heat Map</h3>
              <p className="text-xs text-muted-foreground">
                {Object.keys(countryData).length} countries
              </p>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 lg:gap-4">
              <div>
                <p className="text-[10px] lg:text-xs font-medium text-foreground/70 mb-0.5 lg:mb-1">Total Nodes</p>
                <p className="text-xl lg:text-2xl font-bold text-foreground">{nodes.length}</p>
              </div>
              <div>
                <p className="text-[10px] lg:text-xs font-medium text-foreground/70 mb-0.5 lg:mb-1">Peak Density</p>
                <p className="text-xl lg:text-2xl font-bold text-foreground">{maxCount}</p>
              </div>
            </div>
            
            {/* Color Scale */}
            <div>
              <p className="text-[10px] lg:text-xs font-medium text-foreground/70 mb-1 lg:mb-2">Node Density Scale</p>
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <span className="text-[10px] lg:text-xs text-muted-foreground">Low</span>
                <div className="flex-1 h-2 lg:h-3 rounded-full bg-gradient-to-r from-red-950 via-orange-600 to-orange-400"></div>
                <span className="text-[10px] lg:text-xs text-muted-foreground">High</span>
              </div>
            </div>

            {/* Top Countries */}
            {topCountries.length > 0 && (
              <div>
                <p className="text-[10px] lg:text-xs font-medium text-foreground/70 mb-1 lg:mb-2">Top Countries</p>
                <div className="space-y-1 lg:space-y-1.5">
                  {topCountries.slice(0, 3).map((country) => {
                    const flag = getCountryFlag(country.name);
                    return (
                      <div
                        key={country.name}
                        className="flex items-center justify-between px-1.5 lg:px-2 py-1 lg:py-1.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer border border-border/20"
                        onClick={() => handleCountryClick(country.name)}
                      >
                        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
                          <span className="text-xs lg:text-sm">{flag || '🌍'}</span>
                          <span className="text-[10px] lg:text-xs text-foreground truncate font-medium">{country.name}</span>
                        </div>
                        <span className="text-[10px] lg:text-xs font-bold text-foreground ml-1 lg:ml-2">{country.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="pt-1 lg:pt-2 border-t border-border/40">
            <p className="text-[10px] lg:text-xs text-muted-foreground leading-tight lg:leading-relaxed">
              Hover for details • Click to explore
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(WorldMapHeatmap);
