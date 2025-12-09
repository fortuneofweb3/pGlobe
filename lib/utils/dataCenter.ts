/**
 * Detect cloud provider/data center from IP address
 * Uses common IP ranges and hostname patterns
 */

export function detectDataCenter(ip: string, hostname?: string): string | null {
  if (!ip) return null;

  // Check hostname patterns first (more reliable)
  if (hostname) {
    const hostnameLower = hostname.toLowerCase();
    if (hostnameLower.includes('gcp') || hostnameLower.includes('google')) return 'GCP';
    if (hostnameLower.includes('aws') || hostnameLower.includes('amazon') || hostnameLower.includes('ec2')) return 'AWS';
    if (hostnameLower.includes('azure') || hostnameLower.includes('microsoft')) return 'Azure';
    if (hostnameLower.includes('digitalocean') || hostnameLower.includes('droplet')) return 'DigitalOcean';
    if (hostnameLower.includes('linode')) return 'Linode';
    if (hostnameLower.includes('vultr')) return 'Vultr';
    if (hostnameLower.includes('hetzner')) return 'Hetzner';
    if (hostnameLower.includes('contabo')) return 'Contabo';
    if (hostnameLower.includes('netcup')) return 'Netcup';
    if (hostnameLower.includes('ovh')) return 'OVH';
  }

  // Extract IP parts
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const firstOctet = parseInt(parts[0], 10);
  const secondOctet = parseInt(parts[1], 10);

  // GCP ranges (approximate)
  if (
    (firstOctet === 35 && secondOctet >= 184 && secondOctet <= 191) ||
    (firstOctet === 34 && secondOctet >= 95 && secondOctet <= 127) ||
    (firstOctet === 104 && secondOctet >= 133 && secondOctet <= 199)
  ) {
    return 'GCP';
  }

  // AWS ranges (approximate)
  if (
    (firstOctet === 3 && secondOctet >= 0 && secondOctet <= 255) ||
    (firstOctet === 13 && secondOctet >= 0 && secondOctet <= 255) ||
    (firstOctet === 52 && secondOctet >= 0 && secondOctet <= 95) ||
    (firstOctet === 54 && secondOctet >= 0 && secondOctet <= 255)
  ) {
    return 'AWS';
  }

  // Azure ranges (approximate)
  if (
    (firstOctet === 13 && secondOctet >= 64 && secondOctet <= 79) ||
    (firstOctet === 40 && secondOctet >= 64 && secondOctet <= 79) ||
    (firstOctet === 52 && secondOctet >= 160 && secondOctet <= 191)
  ) {
    return 'Azure';
  }

  // DigitalOcean ranges
  if (
    (firstOctet === 159 && secondOctet >= 89 && secondOctet <= 255) ||
    (firstOctet === 178 && secondOctet >= 128 && secondOctet <= 255)
  ) {
    return 'DigitalOcean';
  }

  // Hetzner ranges
  if (
    (firstOctet === 5 && secondOctet >= 9 && secondOctet <= 255) ||
    (firstOctet === 49 && secondOctet >= 12 && secondOctet <= 15) ||
    (firstOctet === 78 && secondOctet >= 46 && secondOctet <= 47) ||
    (firstOctet === 88 && secondOctet >= 198 && secondOctet <= 199) ||
    (firstOctet === 95 && secondOctet >= 216 && secondOctet <= 255) ||
    (firstOctet === 144 && secondOctet >= 76 && secondOctet <= 79) ||
    (firstOctet === 157 && secondOctet >= 90 && secondOctet <= 91) ||
    (firstOctet === 195 && secondOctet >= 201 && secondOctet <= 255)
  ) {
    return 'Hetzner';
  }

  // Contabo ranges
  if (
    (firstOctet === 173 && secondOctet >= 212 && secondOctet <= 255) ||
    (firstOctet === 161 && secondOctet >= 97 && secondOctet <= 255)
  ) {
    return 'Contabo';
  }

  // Netcup ranges
  if (
    (firstOctet === 37 && secondOctet >= 114 && secondOctet <= 115) ||
    (firstOctet === 46 && secondOctet >= 38 && secondOctet <= 39) ||
    (firstOctet === 185 && secondOctet >= 185 && secondOctet <= 255)
  ) {
    return 'Netcup';
  }

  return null;
}

/**
 * Get region name from location data
 */
export function getRegionName(locationData?: { country?: string; countryCode?: string }): string | null {
  if (!locationData) return null;

  // Map country codes to common region names
  const regionMap: Record<string, string> = {
    'US': 'US-East',
    'CA': 'US-East',
    'GB': 'EU-West',
    'DE': 'EU-West',
    'FR': 'EU-West',
    'NL': 'EU-West',
    'IT': 'EU-West',
    'ES': 'EU-West',
    'PL': 'EU-West',
    'CN': 'Asia-Pacific',
    'JP': 'Asia-Pacific',
    'KR': 'Asia-Pacific',
    'SG': 'Asia-Pacific',
    'AU': 'Asia-Pacific',
    'NZ': 'Asia-Pacific',
    'IN': 'Asia-Pacific',
    'TH': 'Asia-Pacific',
    'MY': 'Asia-Pacific',
    'ID': 'Asia-Pacific',
    'PH': 'Asia-Pacific',
    'VN': 'Asia-Pacific',
    'BR': 'South America',
    'MX': 'US-West',
    'AR': 'South America',
  };

  if (locationData.countryCode && regionMap[locationData.countryCode]) {
    return regionMap[locationData.countryCode];
  }

  // Fallback to country name
  return locationData.country || null;
}

