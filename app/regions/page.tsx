'use client';

import { useMemo, Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { RefreshCw, MapPin, Server, Users, TrendingUp, X } from 'lucide-react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

// Map country codes to continents
const getContinentFromCountryCode = (countryCode?: string): string | null => {
  if (!countryCode) return null;
  
  const continentMap: Record<string, string> = {
    // North America
    'US': 'North America', 'CA': 'North America', 'MX': 'North America',
    'GT': 'North America', 'BZ': 'North America', 'SV': 'North America',
    'HN': 'North America', 'NI': 'North America', 'CR': 'North America',
    'PA': 'North America', 'CU': 'North America', 'JM': 'North America',
    'HT': 'North America', 'DO': 'North America', 'PR': 'North America',
    'BS': 'North America', 'BB': 'North America', 'TT': 'North America',
    // South America
    'BR': 'South America', 'AR': 'South America', 'CL': 'South America',
    'CO': 'South America', 'PE': 'South America', 'VE': 'South America',
    'EC': 'South America', 'BO': 'South America', 'PY': 'South America',
    'UY': 'South America', 'GY': 'South America', 'SR': 'South America',
    'GF': 'South America', 'FK': 'South America',
    // Europe
    'GB': 'Europe', 'FR': 'Europe', 'DE': 'Europe', 'IT': 'Europe',
    'ES': 'Europe', 'PL': 'Europe', 'NL': 'Europe', 'BE': 'Europe',
    'GR': 'Europe', 'PT': 'Europe', 'CZ': 'Europe', 'RO': 'Europe',
    'HU': 'Europe', 'SE': 'Europe', 'AT': 'Europe', 'CH': 'Europe',
    'BG': 'Europe', 'DK': 'Europe', 'FI': 'Europe', 'IE': 'Europe',
    'HR': 'Europe', 'SK': 'Europe', 'LT': 'Europe', 'SI': 'Europe',
    'LV': 'Europe', 'EE': 'Europe', 'LU': 'Europe', 'MT': 'Europe',
    'CY': 'Europe', 'IS': 'Europe', 'NO': 'Europe', 'RU': 'Europe',
    'UA': 'Europe', 'BY': 'Europe', 'MD': 'Europe', 'AL': 'Europe',
    'MK': 'Europe', 'RS': 'Europe', 'BA': 'Europe', 'ME': 'Europe',
    'XK': 'Europe',
    // Asia
    'CN': 'Asia', 'IN': 'Asia', 'JP': 'Asia', 'KR': 'Asia',
    'ID': 'Asia', 'TH': 'Asia', 'VN': 'Asia', 'PH': 'Asia',
    'MY': 'Asia', 'SG': 'Asia', 'BD': 'Asia', 'PK': 'Asia',
    'IR': 'Asia', 'IQ': 'Asia', 'SA': 'Asia', 'AE': 'Asia',
    'IL': 'Asia', 'TR': 'Asia', 'KZ': 'Asia', 'UZ': 'Asia',
    'MM': 'Asia', 'KH': 'Asia', 'LA': 'Asia', 'NP': 'Asia',
    'LK': 'Asia', 'AF': 'Asia', 'MN': 'Asia', 'TJ': 'Asia',
    'KG': 'Asia', 'TM': 'Asia', 'AM': 'Asia', 'AZ': 'Asia',
    'GE': 'Asia', 'BH': 'Asia', 'QA': 'Asia', 'KW': 'Asia',
    'OM': 'Asia', 'YE': 'Asia', 'JO': 'Asia', 'LB': 'Asia',
    'SY': 'Asia', 'PS': 'Asia', 'BN': 'Asia', 'TL': 'Asia',
    'MV': 'Asia', 'BT': 'Asia',
    // Africa
    'NG': 'Africa', 'ET': 'Africa', 'EG': 'Africa', 'ZA': 'Africa',
    'KE': 'Africa', 'UG': 'Africa', 'TZ': 'Africa', 'GH': 'Africa',
    'DZ': 'Africa', 'SD': 'Africa', 'MA': 'Africa', 'AO': 'Africa',
    'MZ': 'Africa', 'MG': 'Africa', 'CM': 'Africa', 'CI': 'Africa',
    'NE': 'Africa', 'BF': 'Africa', 'ML': 'Africa', 'MW': 'Africa',
    'ZM': 'Africa', 'SN': 'Africa', 'TD': 'Africa', 'SO': 'Africa',
    'ZW': 'Africa', 'GN': 'Africa', 'RW': 'Africa', 'BJ': 'Africa',
    'TN': 'Africa', 'BI': 'Africa', 'SS': 'Africa', 'TG': 'Africa',
    'SL': 'Africa', 'LY': 'Africa', 'LR': 'Africa', 'MR': 'Africa',
    'CF': 'Africa', 'ER': 'Africa', 'GM': 'Africa', 'GW': 'Africa',
    'GQ': 'Africa', 'GA': 'Africa', 'CG': 'Africa', 'CD': 'Africa',
    'ST': 'Africa', 'CV': 'Africa', 'DJ': 'Africa', 'SC': 'Africa',
    'MU': 'Africa', 'KM': 'Africa', 'BW': 'Africa', 'NA': 'Africa',
    'LS': 'Africa', 'SZ': 'Africa',
    // Oceania
    'AU': 'Oceania', 'NZ': 'Oceania', 'PG': 'Oceania', 'FJ': 'Oceania',
    'NC': 'Oceania', 'PF': 'Oceania', 'SB': 'Oceania', 'VU': 'Oceania',
    'WS': 'Oceania', 'KI': 'Oceania', 'FM': 'Oceania', 'MH': 'Oceania',
    'PW': 'Oceania', 'TO': 'Oceania', 'TV': 'Oceania', 'NR': 'Oceania',
    // Antarctica (unlikely but included)
    'AQ': 'Antarctica',
  };
  
  return continentMap[countryCode.toUpperCase()] || null;
};

// Country Card Component with fade-in flag
function CountryCard({ country, flagUrl }: { 
  country: {
    name: string;
    country: string;
    countryCode?: string;
    nodes: any[];
    online: number;
    offline: number;
    syncing: number;
    totalStorage: number;
    totalCredits: number;
    avgLatency: number;
    nodeCount: number;
  }; 
  flagUrl: string | null 
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link
      href={`/regions/${encodeURIComponent(country.name)}`}
      className="card hover:bg-muted transition-all group relative overflow-hidden"
    >
      {/* Blurred flag background */}
      {flagUrl && (
        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src={flagUrl}
              alt={country.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onLoad={() => setImageLoaded(true)}
              className={`object-cover blur-sm scale-150 group-hover:scale-[1.7] transition-all duration-500 select-none pointer-events-none ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              priority={false}
              quality={75}
              unoptimized={false}
            />
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground group-hover:text-[#F0A741] transition-colors">
              {country.name}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{country.nodeCount}</div>
            <div className="text-xs text-foreground/60">nodes</div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#3F8277]/25 border border-[#3F8277]/40 rounded-lg p-2">
            <div className="text-xs text-foreground/60 mb-1">Online</div>
            <div className="text-lg font-bold text-[#3F8277]">{country.online}</div>
          </div>
          <div className="bg-[#F0A741]/25 border border-[#F0A741]/40 rounded-lg p-2">
            <div className="text-xs text-foreground/60 mb-1">Syncing</div>
            <div className="text-lg font-bold text-[#F0A741]">{country.syncing}</div>
          </div>
          <div className="bg-gray-500/25 border border-gray-500/40 rounded-lg p-2">
            <div className="text-xs text-foreground/60 mb-1">Offline</div>
            <div className="text-lg font-bold text-gray-400">{country.offline}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 text-sm">
          {country.totalStorage > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-foreground/60">Total Storage</span>
              <span className="font-mono font-semibold text-foreground">
                {formatBytes(country.totalStorage)}
              </span>
            </div>
          )}
          {country.totalCredits > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-foreground/60">Total Credits</span>
              <span className="font-mono font-semibold text-foreground">
                {country.totalCredits.toLocaleString()}
              </span>
            </div>
          )}
          {country.avgLatency > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-foreground/60">Avg Latency</span>
              <span className="font-mono font-semibold text-foreground">
                {country.avgLatency.toFixed(0)}ms
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function RegionsPageContent() {
  const { nodes, loading, error, lastUpdate, refreshNodes } = useNodes();
  const searchParams = useSearchParams();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Get country from URL parameter on mount
  useEffect(() => {
    const countryParam = searchParams.get('country');
    if (countryParam) {
      setSelectedCountry(decodeURIComponent(countryParam));
    }
  }, [searchParams]);

  // Aggregate nodes by country
  const regionData = useMemo(() => {
    const countries: Record<string, {
      name: string;
      country: string;
      countryCode?: string;
      nodes: typeof nodes;
      online: number;
      offline: number;
      syncing: number;
      totalStorage: number;
      totalCredits: number;
      avgLatency: number;
      nodeCount: number;
      cities: Set<string>;
    }> = {};

    nodes.forEach((node) => {
      if (!node.locationData || !node.locationData.country) return;

      const countryName = node.locationData.country;
      
      if (!countries[countryName]) {
        countries[countryName] = {
          name: countryName,
          country: countryName,
          countryCode: node.locationData.countryCode,
          nodes: [],
          online: 0,
          offline: 0,
          syncing: 0,
          totalStorage: 0,
          totalCredits: 0,
          avgLatency: 0,
          nodeCount: 0,
          cities: new Set<string>(),
        };
      }

      countries[countryName].nodes.push(node);
      countries[countryName].nodeCount++;

      if (node.status === 'online') {
        countries[countryName].online++;
      } else if (node.status === 'syncing') {
        countries[countryName].syncing++;
      } else {
        countries[countryName].offline++;
      }

      if (node.locationData?.city) {
        countries[countryName].cities.add(node.locationData.city);
      }

      if (node.storageCapacity) {
        countries[countryName].totalStorage += node.storageCapacity;
      }

      if (node.credits !== undefined && node.credits !== null) {
        countries[countryName].totalCredits += node.credits;
      }
    });

    // Calculate average latency per country
    Object.values(countries).forEach((country) => {
      const latencies = country.nodes
        .map(n => n.latency)
        .filter((lat): lat is number => lat !== undefined && lat !== null);
      
      if (latencies.length > 0) {
        country.avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      }
    });

    return Object.values(countries).map(country => ({
      ...country,
      cities: Array.from(country.cities),
    })).sort((a, b) => b.nodeCount - a.nodeCount);
  }, [nodes]);

  // Calculate continents, countries, and cities
  const stats = useMemo(() => {
    const continents = new Set<string>();
    const countriesSet = new Set<string>();
    const citiesSet = new Set<string>();
    
    nodes.forEach((node) => {
      if (node.locationData?.country) {
        countriesSet.add(node.locationData.country);
      }
      if (node.locationData?.city) {
        citiesSet.add(node.locationData.city);
      }
      if (node.locationData?.countryCode) {
        const continent = getContinentFromCountryCode(node.locationData.countryCode);
        if (continent) {
          continents.add(continent);
        }
      }
    });
    
    return {
      continents: continents.size,
      countries: countriesSet.size,
      cities: citiesSet.size,
    };
  }, [nodes]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Show loading skeleton when loading and no data
  if (loading && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Header activePage="regions" loading={true} onRefresh={() => {}} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
              Network Regions
            </h1>
            <p className="text-foreground/60 text-sm sm:text-base">
              Geographic distribution of nodes across regions
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {['Total Regions', 'Total Nodes', 'Online Nodes'].map((label) => (
              <div key={label} className="card-stat">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">{label}</span>
                  <MapPin className="w-4 h-4 text-foreground/40" />
                </div>
                <div className="h-8 w-16 bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Region Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card">
                <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Header activePage="regions" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      <Header activePage="regions" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                    <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                    Network Regions
                  </h1>
                  <p className="text-foreground/60 text-sm sm:text-base">
                    Geographic distribution of nodes across countries
                  </p>
                </div>
                {selectedCountry && (
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 rounded-lg transition-colors text-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear filter
                  </button>
                )}
              </div>
              {selectedCountry && (
                <div className="mt-3 p-3 bg-[#F0A741]/10 border border-[#F0A741]/30 rounded-lg">
                  <p className="text-sm text-foreground">
                    Showing nodes in <span className="font-semibold text-[#F0A741]">{selectedCountry}</span>
                  </p>
                </div>
              )}
            </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card-stat">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Total Nodes</span>
              <Server className="w-4 h-4 text-foreground/40" />
            </div>
            <div className="text-2xl font-bold text-foreground">{nodes.length}</div>
          </div>

          <div className="card-stat">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Continents</span>
              <MapPin className="w-4 h-4 text-foreground/40" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.continents}</div>
          </div>

          <div className="card-stat">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Countries</span>
              <MapPin className="w-4 h-4 text-foreground/40" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.countries}</div>
          </div>

          <div className="card-stat">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Cities</span>
              <MapPin className="w-4 h-4 text-foreground/40" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.cities}</div>
          </div>
        </div>

        {/* Countries Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regionData
            .filter(country => !selectedCountry || country.name === selectedCountry)
            .map((country) => {
              const flagUrl = country.countryCode
                ? `/api/flag-proxy?code=${country.countryCode.toLowerCase()}`
                : null;
              return (
                <CountryCard key={country.name} country={country} flagUrl={flagUrl} />
              );
            })}
        </div>

        {regionData.length === 0 && !loading && (
          <div className="card text-center" style={{ padding: '2rem' }}>
            <p className="text-foreground/60">No countries found</p>
          </div>
        )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegionsPage() {
  return (
    <Suspense fallback={null}>
      <RegionsPageContent />
    </Suspense>
  );
}

