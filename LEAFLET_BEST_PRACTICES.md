# Leaflet & React-Leaflet Best Practices

## Overview
This document summarizes best practices for using Leaflet with React/Next.js, based on research and our implementation.

## 1. Map Container Initialization Error

### Problem
"Map container is already initialized" error occurs when:
- React re-renders the MapContainer component
- Navigating between routes without proper cleanup
- Component unmounts/remounts rapidly

### Solutions

#### A. Use Unique Keys (Recommended for React-Leaflet)
Add a unique `key` prop to `MapContainer` to force remounting when needed:

```jsx
<MapContainer
  key={`map-${node.id}-${node.locationData.lat}-${node.locationData.lon}`}
  center={[lat, lon]}
  zoom={zoom}
  // ... other props
>
```

**Benefits:**
- Forces React to unmount and remount the component when key changes
- Clean slate for each map instance
- Prevents initialization conflicts

#### B. Proper Cleanup (Vanilla Leaflet)
In vanilla Leaflet, check and clean up before initialization:

```javascript
var container = L.DomUtil.get('map');
if (container._leaflet_id) {
  container._leaflet_id = null; // Reset container
}
var map = L.map('map').setView([lat, lon], zoom);
```

#### C. Component Lifecycle Management
- Use `useEffect` to handle map initialization
- Ensure cleanup in `useEffect` return function
- Avoid unnecessary re-renders of MapContainer

## 2. Removing Built-in Text Labels

### Current Approach
We use CARTO Dark Matter tiles with labels:
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png
```

### Alternative: Label-Free Tiles
CARTO offers label-free versions:
- **Dark (No Labels):** `dark_nolabels` instead of `dark_all`
- **Light (No Labels):** `light_nolabels` instead of `light_all`

Example:
```jsx
<TileLayer
  attribution=""
  url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
  subdomains="abcd"
  maxZoom={20}
/>
```

**Benefits:**
- Clean map without country/city names
- Full control over what labels appear
- Better for custom overlays

## 3. High-Quality Tile Configuration

### Current Implementation
```jsx
<TileLayer
  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
  tileSize={512}
  zoomOffset={-1}
/>
```

**Explanation:**
- `@2x.png`: Requests 2x resolution tiles (retina/high-DPI)
- `tileSize={512}`: Tells Leaflet tiles are 512x512 (default is 256)
- `zoomOffset={-1}`: Adjusts zoom level since we're using 2x tiles
- This combination provides high-quality, sharp maps

### Tile Layer Options
- `subdomains="abcd"`: Distributes requests across multiple subdomains (performance)
- `maxZoom={20}`: Maximum zoom level
- `minZoom={0}`: Minimum zoom level
- `detectRetina={true}`: Auto-detect high-DPI displays (when not using @2x)

## 4. React-Leaflet Dynamic Imports

### SSR Issues
Leaflet requires `window` object and DOM, which aren't available during SSR.

### Solution: Dynamic Imports with SSR Disabled
```jsx
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
```

**Why This Works:**
- `ssr: false` prevents server-side rendering
- Components only load on client
- Avoids "window is not defined" errors

### Loading CSS
Load Leaflet CSS dynamically in `useEffect`:

```jsx
useEffect(() => {
  if (!document.head.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
}, []);
```

## 5. Performance Optimization

### Memoization
Use `useMemo` for expensive calculations:

```jsx
const nodesWithLocation = useMemo(() => {
  return nodes.filter((node) => 
    node.locationData?.lat && node.locationData?.lon
  );
}, [nodes]);
```

### Conditional Rendering
Only render map when ready:

```jsx
{isClient && hasLocationData ? (
  <MapContainer>
    {/* map content */}
  </MapContainer>
) : (
  <div>Loading map...</div>
)}
```

### Marker Clustering (For Many Markers)
Consider using `react-leaflet-cluster` for 100+ markers:
```bash
npm install react-leaflet-cluster
```

## 6. Attribution Control

### Hiding Attribution
Set `attributionControl={false}` on MapContainer:

```jsx
<MapContainer
  attributionControl={false}
  // ... other props
>
```

### Custom Attribution
Or set empty string on TileLayer:

```jsx
<TileLayer
  attribution=""
  // ... other props
/>
```

**Note:** Check tile provider's terms of service regarding attribution requirements.

## 7. Common Patterns

### Map with Nearby Points
```jsx
const nearbyNodes = allNodes.filter((n) => {
  if (!n.locationData?.lat || !n.locationData?.lon) return false;
  const distance = calculateDistance(
    mainNode.lat, mainNode.lon,
    n.locationData.lat, n.locationData.lon
  );
  return distance < 50; // 50km radius
});
```

### Status-Based Styling
```jsx
const statusColors = {
  online: '#3F8277',
  syncing: '#F0A741',
  offline: '#ED1C24',
};

<CircleMarker
  pathOptions={{
    fillColor: statusColors[node.status] || statusColors.offline,
    fillOpacity: 0.8,
    color: '#fff',
    weight: 2,
  }}
/>
```

## 8. Troubleshooting

### Map Not Rendering
1. Check if `isClient` state is true
2. Verify Leaflet CSS is loaded
3. Ensure container has explicit height/width
4. Check browser console for errors

### Markers Not Appearing
1. Verify coordinates are valid (lat: -90 to 90, lon: -180 to 180)
2. Check if markers are outside current viewport bounds
3. Use `map.fitBounds()` to auto-fit all markers

### Performance Issues
1. Reduce number of markers (use clustering)
2. Debounce map updates
3. Use `useMemo` for filtered data
4. Consider virtualization for large datasets

## 9. Recommended Resources

- **Leaflet Docs:** https://leafletjs.com/
- **React-Leaflet Docs:** https://react-leaflet.js.org/
- **CARTO Basemaps:** https://carto.com/basemaps/
- **Stack Overflow:** Search "react-leaflet" for common issues

## 10. Current Implementation Status

✅ Fixed "Map container already initialized" with unique keys  
✅ Using high-quality 2x tiles with proper configuration  
✅ Dynamic imports with SSR disabled  
✅ Conditional rendering based on client-side state  
✅ Attribution control disabled  
✅ Proper TypeScript type checking  

🔄 Potential Improvement: Switch to `dark_nolabels` for cleaner maps



