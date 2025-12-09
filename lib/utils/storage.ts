/**
 * Formats bytes into human-readable storage units (GB, TB, PB)
 * @param bytes - Storage size in bytes
 * @returns Formatted string (e.g., "2.30 TB", "938.44 GB")
 */
export function formatStorageBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return 'N/A';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1024 ** 2) return `${(gb / (1024 ** 2)).toFixed(2)} PB`;
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Formats bytes into human-readable storage units with fallback for small values
 * Handles B, KB, MB, GB, TB, PB
 * @param bytes - Storage size in bytes
 * @returns Formatted string (e.g., "2.30 TB", "938.44 GB", "512.00 MB")
 */
export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = sizes[Math.min(i, sizes.length - 1)];
  const value = bytes / Math.pow(1024, Math.min(i, sizes.length - 1));
  return `${value.toFixed(2)} ${size}`;
}

