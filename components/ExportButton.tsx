'use client';

import { PNode } from '@/lib/types/pnode';

interface ExportButtonProps {
  nodes: PNode[];
  filename?: string;
}

export default function ExportButton({ nodes, filename = 'xandeum-pnodes' }: ExportButtonProps) {
  const exportToCSV = () => {
    if (nodes.length === 0) return;

    const headers = [
      'ID',
      'Public Key',
      'Address',
      'Status',
      'Uptime (%)',
      'Storage Capacity (GB)',
      'Storage Used (GB)',
      'Location',
      'Latency (ms)',
      'Reputation',
      'Version',
      'Last Seen',
    ];

    const rows = nodes.map((node) => [
      node.id,
      node.publicKey,
      node.address || '',
      node.status || '',
      node.uptime?.toFixed(2) || '',
      node.storageCapacity ? (node.storageCapacity / (1024 * 1024 * 1024)).toFixed(2) : '',
      node.storageUsed ? (node.storageUsed / (1024 * 1024 * 1024)).toFixed(2) : '',
      node.location || '',
      node.latency?.toString() || '',
      node.reputation?.toString() || '',
      node.version || '',
      node.lastSeen ? new Date(node.lastSeen).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (nodes.length === 0) return;

    const data = {
      exportDate: new Date().toISOString(),
      totalNodes: nodes.length,
      nodes: nodes.map((node) => ({
        ...node,
        storageCapacityGB: node.storageCapacity ? node.storageCapacity / (1024 * 1024 * 1024) : null,
        storageUsedGB: node.storageUsed ? node.storageUsed / (1024 * 1024 * 1024) : null,
      })),
    };

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportToCSV}
        disabled={nodes.length === 0}
        className="btn btn-primary text-sm"
      >
        Export CSV
      </button>
      <button
        onClick={exportToJSON}
        disabled={nodes.length === 0}
        className="btn btn-primary text-sm"
      >
        Export JSON
      </button>
    </div>
  );
}

