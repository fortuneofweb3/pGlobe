const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlContent = fs.readFileSync(
  path.join(__dirname, '../components/random ass file'),
  'utf-8'
);

// Extract all country paths using regex
const pathRegex = /<path d="([^"]*)"[^>]*><title>([^<]*)<\/title><\/path>/g;
const countries = [];
let match;

while ((match = pathRegex.exec(htmlContent)) !== null) {
  countries.push({
    name: match[2],
    path: match[1]
  });
}

// Create TypeScript object
const output = `// Auto-generated world map data
export interface CountryPath {
  name: string;
  path: string;
}

export const WORLD_MAP_PATHS: CountryPath[] = ${JSON.stringify(countries, null, 2)};
`;

// Write to file
fs.writeFileSync(
  path.join(__dirname, '../lib/data/world-map-paths.ts'),
  output,
  'utf-8'
);

console.log(`✅ Extracted ${countries.length} countries`);
