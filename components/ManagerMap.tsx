"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { type PNode } from "@/lib/types/pnode";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix generic marker icon
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for different statuses
const STATUS_COLORS = {
    online: "#3F8277",  // Green
    syncing: "#F0A741", // Orange
    offline: "#ED1C24", // Red
} as const;

function getPinIcon(status: string = "offline", isSelected: boolean = false) {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;
    const size = isSelected ? 40 : 30; // Larger if selected

    return L.divIcon({
        html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; transition: all 0.3s ease;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="2" class="drop-shadow-lg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#fff"/>
        </svg>
        ${isSelected ? `<div style="position: absolute; -bottom-2px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px ${color};"></div>` : ''}
      </div>
    `,
        className: "custom-pin-icon",
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
    });
}

// Controller to handle programmatic moves
function MapController({ selectedNode }: { selectedNode: PNode | null }) {
    const map = useMap();

    useEffect(() => {
        if (selectedNode && selectedNode.locationData?.lat && selectedNode.locationData?.lon) {
            map.flyTo(
                [selectedNode.locationData.lat, selectedNode.locationData.lon],
                10, // Close zoom
                { duration: 1.5 }
            );
        } else if (!selectedNode) {
            // If no node selected, maybe fit bounds to all markers? 
            // We can do that in parent if needed, but for now we just stay put.
        }
    }, [selectedNode, map]);

    return null;
}

interface ManagerMapProps {
    nodes: PNode[];
    selectedNode: PNode | null;
    onNodeSelect: (node: PNode) => void;
}

export default function ManagerMap({ nodes, selectedNode, onNodeSelect }: ManagerMapProps) {
    // Calculate center based on all nodes or default to world view
    const center: [number, number] = useMemo(() => {
        if (nodes.length > 0 && nodes[0].locationData?.lat && nodes[0].locationData?.lon) {
            return [nodes[0].locationData.lat, nodes[0].locationData.lon];
        }
        return [20, 0];
    }, []);

    // Memoize valid nodes to avoid re-filtering
    const validNodes = useMemo(() => nodes.filter(n => n.locationData?.lat && n.locationData?.lon), [nodes]);

    return (
        <div className="h-full w-full rounded-xl overflow-hidden border border-white/10 relative z-0">
            <MapContainer
                center={center}
                zoom={2}
                scrollWheelZoom={false}
                zoomControl={false}
                doubleClickZoom={false}
                touchZoom={false}
                className="h-full w-full bg-[#0a0a0a]"
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution=""
                />

                <MapController selectedNode={selectedNode} />

                {validNodes.map((node, i) => (
                    <Marker
                        key={node.id || node.publicKey || i}
                        position={[node.locationData!.lat, node.locationData!.lon]}
                        icon={getPinIcon(node.status, selectedNode?.id === node.id)}
                        eventHandlers={{
                            click: () => onNodeSelect(node),
                        }}
                    >
                        <Popup className="glass-popup">
                            <div className="text-sm font-sans p-1">
                                <div className="font-bold text-foreground mb-1">{(node.id || node.publicKey || 'Unknown').slice(0, 8)}...</div>
                                <div className="text-muted-foreground">{node.locationData?.city}, {node.locationData?.country}</div>
                                <div className={`text-xs mt-1 uppercase font-bold text-${STATUS_COLORS[node.status as keyof typeof STATUS_COLORS] ? 'white' : 'white'}`}>
                                    {node.status}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Custom Styles for Leaflet Popup to match Glassmorphism */}
            <style jsx global>{`
                .leaflet-popup-content-wrapper {
                    background: rgba(10, 10, 10, 0.9);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    border-radius: 12px;
                }
                .leaflet-popup-tip {
                    background: rgba(10, 10, 10, 0.9);
                }
                .leaflet-container {
                    font-family: inherit;
                }
            `}</style>
        </div>
    );
}


