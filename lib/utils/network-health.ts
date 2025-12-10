import { PNode } from '@/lib/types/pnode';

/**
 * Get the latest version using semantic version comparison
 * This matches the logic used in VersionDistribution component
 */
export function getLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  
  // Filter out unknown/invalid versions
  const validVersions = versions.filter(v => v && v !== 'Unknown' && v !== 'unknown');
  if (validVersions.length === 0) return null;
  
  // Sort by semantic version (highest first)
  const sorted = [...validVersions].sort((a, b) => {
    // Try semantic version comparison
    const aParts = a.replace('v', '').split('.').map(Number);
    const bParts = b.replace('v', '').split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return bVal - aVal; // Descending order
    }
    return 0;
  });
  
  return sorted[0] || null;
}

/**
 * Calculate network health score using consistent formula across all pages
 * 
 * Formula:
 * - 40% Availability (online nodes)
 * - 35% Version Health (% on latest version)
 * - 25% Distribution (geographic diversity)
 */
export function calculateNetworkHealth(nodes: PNode[]): {
  availability: number;
  versionHealth: number;
  distribution: number;
  overall: number;
  countries: number;
  cities: number;
} {
  if (nodes.length === 0) {
    return { availability: 0, versionHealth: 0, distribution: 0, overall: 0, countries: 0, cities: 0 };
  }

  // 1. Availability Score (40% weight) - % of nodes online
  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const availability = (onlineNodes / nodes.length) * 100;

  // 2. Version Health (35% weight) - % on latest version (using semantic version comparison)
  const versions = nodes.map(n => n.version).filter(v => v);
  const latestVersion = getLatestVersion(versions);
  const latestVersionNodes = latestVersion ? nodes.filter(n => n.version === latestVersion).length : 0;
  const versionHealth = latestVersion ? (latestVersionNodes / nodes.length) * 100 : 0;

  // 3. Distribution Score (25% weight) - Geographic diversity
  const countries = new Set(nodes.map(n => n.locationData?.country).filter(c => c));
  const cities = new Set(nodes.map(n => n.locationData?.city).filter(c => c));
  // More countries/cities = better distribution
  // Normalize: 10+ countries = 100%, 1 country = 10%
  const countryDiversity = Math.min(100, (countries.size / 10) * 100);
  const cityDiversity = Math.min(100, (cities.size / 20) * 100);
  const distribution = (countryDiversity * 0.6 + cityDiversity * 0.4);

  // Overall weighted score
  const overall = Math.round(
    availability * 0.40 +
    versionHealth * 0.35 +
    distribution * 0.25
  );

  return {
    availability: Math.round(availability),
    versionHealth: Math.round(versionHealth),
    distribution: Math.round(distribution),
    overall,
    countries: countries.size,
    cities: cities.size,
  };
}

