'use client';

import { useEffect, useRef, useState } from 'react';
import { PNode } from '@/lib/types/pnode';
import * as d3 from 'd3';

interface NetworkTopologyProps {
  nodes: PNode[];
  width?: number;
  height?: number;
}

export default function NetworkTopology({ nodes, width = 800, height = 600 }: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Build links from actual peer relationships (if available)
    const links: Array<{ source: string; target: string }> = [];
    const nodeMap = new Map(nodes.map(n => [n.pubkey || n.publicKey || n.id, n]));
    
    // Use actual peer data from nodes
    nodes.forEach(node => {
      if (node.peers && Array.isArray(node.peers)) {
        node.peers.forEach(peer => {
          if (peer.pubkey || peer.address) {
            const peerKey = peer.pubkey || peer.address;
            const targetNode = nodeMap.get(peerKey);
            if (targetNode) {
              links.push({
                source: node.pubkey || node.publicKey || node.id,
                target: peerKey,
              });
            }
          }
        });
      }
    });

    // If no peer links, create a simplified network view based on geographic proximity
    // This is a visualization aid, not actual network topology
    if (links.length === 0) {
      nodes.forEach((node, i) => {
        if (node.locationData) {
          const nearby = nodes
            .filter((n, idx) => idx !== i && n.locationData)
            .filter(n => {
              const dist = Math.sqrt(
                Math.pow((node.locationData!.lat - n.locationData!.lat) * 111, 2) + // Convert to km
                Math.pow((node.locationData!.lon - n.locationData!.lon) * 111, 2)
              );
              return dist < 1000; // Within 1000km
            })
            .slice(0, 3); // Max 3 connections
          
          nearby.forEach(n => {
            links.push({
              source: node.pubkey || node.publicKey || node.id,
              target: n.pubkey || n.publicKey || n.id,
            });
          });
        }
      });
    }

    // Initialize nodes at center with spread
    const centerX = width / 2;
    const centerY = height / 2;
    nodes.forEach((node: any, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = 20 + Math.random() * 30;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });

    // Create simulation - bubble map: links pull connected nodes together into clusters
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.pubkey || d.publicKey || d.id).distance(20).strength(0.9))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(centerX, centerY).strength(0.01))
      .force('collision', d3.forceCollide().radius(8));

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#666')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1);

    // Draw nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 5)
      .attr('fill', (d: PNode) => {
        if (selectedNode === (d.pubkey || d.publicKey || d.id)) return '#3b82f6';
        if (d.status === 'online') return '#10b981';
        if (d.status === 'offline') return '#ef4444';
        return '#f59e0b';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (event, d: PNode) => {
        setSelectedNode(d.pubkey || d.publicKey || d.id);
      })
      .call(drag(simulation) as any);

    // Add labels
    const labels = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d: PNode) => {
        const pubkey = d.pubkey || d.publicKey || '';
        return pubkey.substring(0, 8) + '...';
      })
      .attr('font-size', '8px')
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .attr('dy', 20);

    // Update positions on tick
    simulation.on('tick', () => {
      // No boundary constraints - let the forces naturally arrange nodes

      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    // Run simulation
    simulation.alpha(1).restart();

    // Tooltip
    node.append('title')
      .text((d: PNode) => `${d.pubkey || d.publicKey}\nStatus: ${d.status}\nVersion: ${d.version || 'unknown'}`);

  }, [nodes, width, height, selectedNode]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="mb-4 w-full flex items-center justify-center">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Syncing</span>
          </div>
        </div>
      </div>
      <div className="w-full flex justify-center">
        <div className="border rounded-lg bg-white dark:bg-gray-800 overflow-hidden" style={{ width: '100%', maxWidth: width, aspectRatio: `${width}/${height}` }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="bg-white dark:bg-gray-800"
          />
        </div>
      </div>
      {selectedNode && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
          Selected: {selectedNode.substring(0, 16)}...
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Note: Network topology based on peer relationships and geographic proximity. 
        Showing current snapshot data only.
      </div>
    </div>
  );
}

// Drag handler
function drag(simulation: d3.Simulation<any, undefined>) {
  function dragstarted(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event: any, d: any) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}
