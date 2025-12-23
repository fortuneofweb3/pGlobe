"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { type PNode } from "@/lib/types/pnode";
import { MapContainer, TileLayer, Marker, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

// Pin colors based on status
const STATUS_COLORS = {
    online: "#3F8277",
    syncing: "#F0A741",
    offline: "#ED1C24",
} as const;

// Cache for pin icons to avoid recreation
const pinIconCache = new Map<string, L.DivIcon>();

function getPinIcon(status: string = "offline") {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;

    if (pinIconCache.has(color)) {
        return pinIconCache.get(color)!;
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30" fill="none"><path d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 21 9 21s9-15.75 9-21c0-4.97-4.03-9-9-9zm0 12.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;

    const icon = L.divIcon({
        html: `
      <div style="position: relative; width: 32px; height: 40px; overflow: visible;">
        ${svgString}
        <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
      </div>
    `,
        className: "custom-pin-icon",
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40],
    });

    pinIconCache.set(color, icon);
    return icon;
}

// Component to auto-fit bounds to show all nodes with a zoom-in effect
function FitBounds({ nodes, showMarkers, setShowMarkers }: { nodes: PNode[], showMarkers: boolean, setShowMarkers: (v: boolean) => void }) {
    const map = useMap();
    const hasFittedRef = useRef(false);

    useEffect(() => {
        if (hasFittedRef.current) return;

        const validNodes = nodes.filter(n => n.locationData?.lat && n.locationData?.lon);
        if (validNodes.length === 0) return;

        const bounds = L.latLngBounds(
            validNodes.map(n => [n.locationData!.lat, n.locationData!.lon] as [number, number])
        );

        // Wait for the map to be fully loaded and tiles to start appearing
        const timeout = setTimeout(() => {
            map.flyToBounds(bounds, {
                padding: [50, 50],
                maxZoom: 10,
                duration: 1.5, // Fast, high-performance animation
                easeLinearity: 0.5 // Higher value = more ease-in/ease-out effect
            });

            // Fade in markers AFTER the animation completes (1500ms animation + small buffer)
            const fadeTimeout = setTimeout(() => {
                setShowMarkers(true);
                hasFittedRef.current = true;
            }, 1700); // 1500ms animation + 200ms buffer

            return () => clearTimeout(fadeTimeout);
        }, 800);

        return () => clearTimeout(timeout);
    }, [nodes, map]);

    return (
        <style dangerouslySetInnerHTML={{
            __html: `
            .marker-fade-in {
                transition: opacity 1s ease-in-out;
                opacity: 0;
            }
            .marker-fade-in.visible {
                opacity: 1;
            }
        `}} />
    );
}

interface RegionMapProps {
    nodes: PNode[];
}

export default function RegionMap({ nodes }: RegionMapProps) {
    const [showMarkers, setShowMarkers] = React.useState(false);
    // Filter nodes with valid location
    const validNodes = useMemo(() =>
        nodes.filter(n => n.locationData?.lat && n.locationData?.lon),
        [nodes]);

    // Calculate initial center (will be overridden by FitBounds)
    const initialCenter = useMemo((): [number, number] => {
        if (validNodes.length === 0) return [0, 0];
        const avgLat = validNodes.reduce((sum, n) => sum + n.locationData!.lat, 0) / validNodes.length;
        const avgLon = validNodes.reduce((sum, n) => sum + n.locationData!.lon, 0) / validNodes.length;
        return [avgLat, avgLon];
    }, [validNodes]);

    return (
        <MapContainer
            center={initialCenter}
            zoom={2}
            scrollWheelZoom={false}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            zoomControl={false}
            className="region-details-map z-0"
            style={{ height: "100%", width: "100%", backgroundColor: "#000" }}
            attributionControl={false}
        >
            <TileLayer
                attribution=""
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
            />

            <FitBounds nodes={validNodes} showMarkers={showMarkers} setShowMarkers={setShowMarkers} />

            {/* Render all nodes with pin + circle markers like Node Details - only when animation completes */}
            {showMarkers && validNodes.map((node) => {
                const nodeStatus = node.status || 'offline';
                const color = STATUS_COLORS[nodeStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;
                const pinIcon = getPinIcon(nodeStatus);

                return (
                    <React.Fragment key={node.id}>
                        {/* Circle dot underneath the pin */}
                        <CircleMarker
                            center={[node.locationData!.lat, node.locationData!.lon]}
                            radius={6}
                            pathOptions={{
                                fillColor: color,
                                fillOpacity: 0.8,
                                color: '#fff',
                                weight: 1.5,
                            }}
                            interactive={false}
                        />
                        {/* Pin marker on top */}
                        {pinIcon && (
                            <Marker
                                position={[node.locationData!.lat, node.locationData!.lon]}
                                icon={pinIcon}
                                interactive={false}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </MapContainer>
    );
}
