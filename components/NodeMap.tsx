"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { type PNode } from "@/lib/types/pnode";
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, Tooltip } from "react-leaflet";
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

// Component to handle zoom-in effect on mount
function MapZoomHandler({ center, zoom, showMarkers, setShowMarkers }: { center: [number, number], zoom: number, showMarkers: boolean, setShowMarkers: (v: boolean) => void }) {
    const map = useMap();
    const hasZoomedRef = useRef(false);

    useEffect(() => {
        if (hasZoomedRef.current) return;

        // Wait for the map to be fully loaded and tiles to start appearing
        const timeout = setTimeout(() => {
            map.flyTo(center, zoom, {
                duration: 1.5, // Fast, high-performance animation
                easeLinearity: 0.5 // Higher value = more ease-in/ease-out effect
            });

            // Fade in markers AFTER the animation completes (1500ms animation + small buffer)
            const fadeTimeout = setTimeout(() => {
                setShowMarkers(true);
                hasZoomedRef.current = true;
            }, 1700); // 1500ms animation + 200ms buffer

            return () => clearTimeout(fadeTimeout);
        }, 800);

        return () => clearTimeout(timeout);
    }, [map, center, zoom]);

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

interface NodeMapProps {
    node: PNode;
    allNodes: PNode[];
    center: [number, number];
    zoom: number;
}

export default function NodeMap({ node, allNodes, center, zoom }: NodeMapProps) {
    const [showMarkers, setShowMarkers] = React.useState(false);
    if (!node.locationData?.lat || !node.locationData?.lon) return null;

    const nodeLat = node.locationData.lat;
    const nodeLon = node.locationData.lon;

    // Find nearby nodes (within 50km)
    const nearbyNodes = useMemo(() => {
        return allNodes.filter((n) => {
            if (!n.locationData?.lat || !n.locationData?.lon) return false;
            if (n.id === node.id) return false;

            const latDiff = Math.abs(n.locationData.lat - nodeLat);
            const lonDiff = Math.abs(n.locationData.lon - nodeLon);
            const kmLat = latDiff * 111;
            const kmLon = lonDiff * 111 * Math.cos(nodeLat * Math.PI / 180);
            const distance = Math.sqrt(kmLat * kmLat + kmLon * kmLon);
            return distance < 50;
        });
    }, [allNodes, node.id, nodeLat, nodeLon]);

    const nodeStatus = node.status || 'offline';
    const color = STATUS_COLORS[nodeStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;
    const pinIcon = getPinIcon(nodeStatus);

    return (
        <MapContainer
            center={center}
            zoom={2}
            scrollWheelZoom={false}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            zoomControl={false}
            style={{ height: '100%', width: '100%', backgroundColor: '#000' }}
            className="z-0 node-details-map-container"
            attributionControl={false}
        >
            <TileLayer
                attribution=""
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
            />

            <MapZoomHandler center={center} zoom={zoom} showMarkers={showMarkers} setShowMarkers={setShowMarkers} />

            {/* Only render markers after animation completes */}
            {showMarkers && (
                <>
                    {/* Circle dot underneath the pin */}
                    <CircleMarker
                        center={[nodeLat, nodeLon]}
                        radius={12}
                        pathOptions={{
                            fillColor: color,
                            fillOpacity: 0.8,
                            color: '#fff',
                            weight: 2,
                        }}
                        interactive={false}
                    >
                        <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                            <div className="text-sm">
                                <div className="font-semibold mb-1 text-[#F0A741]">📍 Current Node</div>
                                <div className="font-semibold">{node.locationData.city || 'Unknown'}, {node.locationData.country || 'Unknown'}</div>
                            </div>
                        </Tooltip>
                    </CircleMarker>

                    {/* Pin marker on top */}
                    {pinIcon && (
                        <Marker
                            position={[nodeLat, nodeLon]}
                            icon={pinIcon}
                            interactive={false}
                        />
                    )}

                    {/* Nearby nodes */}
                    {nearbyNodes.map((nearbyNode) => {
                        const status = nearbyNode.status || 'offline';
                        const nearbyColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;

                        return (
                            <CircleMarker
                                key={nearbyNode.id}
                                center={[nearbyNode.locationData!.lat, nearbyNode.locationData!.lon]}
                                radius={8}
                                pathOptions={{
                                    fillColor: nearbyColor,
                                    fillOpacity: 0.5,
                                    color: '#fff',
                                    weight: 1.5,
                                }}
                                interactive={false}
                            >
                                <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                                    <div className="text-sm">
                                        <div className="font-semibold mb-1">
                                            {nearbyNode.locationData!.city || 'Unknown'}, {nearbyNode.locationData!.country || 'Unknown'}
                                        </div>
                                    </div>
                                </Tooltip>
                            </CircleMarker>
                        );
                    })}
                </>
            )}
        </MapContainer>
    );
}
