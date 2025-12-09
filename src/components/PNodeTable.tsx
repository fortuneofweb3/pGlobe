import { PNode } from '../lib/prpc';

interface PNodeTableProps {
  nodes: PNode[];
  onNodeClick?: (node: PNode) => void;
}

export default function PNodeTable({ nodes, onNodeClick }: PNodeTableProps) {
  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatUptime = (uptime?: number) => {
    if (!uptime) return 'N/A';
    return `${uptime.toFixed(2)}%`;
  };

  const getStatusBadge = (status?: string) => {
    const statusStyles: Record<string, { bg: string; text: string }> = {
      online: { bg: 'rgb(177, 211, 187)', text: 'rgb(64, 124, 81)' },
      offline: { bg: 'rgb(249, 197, 180)', text: 'rgb(158, 59, 27)' },
      syncing: { bg: 'rgb(249, 197, 180)', text: 'rgb(158, 59, 27)' },
    };
    
    const style = statusStyles[status || 'offline'] || statusStyles.offline;
    return (
      <span 
        className="px-2 py-1 rounded-full font-medium"
        style={{
          backgroundColor: style.bg,
          color: style.text,
          fontSize: '12px',
          lineHeight: '1.4em'
        }}
      >
        {status || 'unknown'}
      </span>
    );
  };

  const formatPublicKey = (key: string) => {
    if (!key) return 'N/A';
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
      <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: 'rgb(191, 191, 191)' }}>
          <tr>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Node ID
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Public Key
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Status
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Uptime
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Storage
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Location
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Latency
            </th>
            <th className="px-6 py-3 text-left uppercase tracking-wider" style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>
              Reputation
            </th>
          </tr>
        </thead>
        <tbody style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-4 text-center" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                No pNodes found
              </td>
            </tr>
          ) : (
            nodes.map((node) => (
              <tr
                key={node.id}
                onClick={() => onNodeClick?.(node)}
                className="cursor-pointer transition-colors"
                style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(191, 191, 191)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(0, 0, 0)', lineHeight: '1.5em' }}>
                  {node.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {formatPublicKey(node.publicKey)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', lineHeight: '1.5em' }}>
                  {getStatusBadge(node.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {formatUptime(node.uptime)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {formatBytes(node.storageUsed)} / {formatBytes(node.storageCapacity)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {node.location || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {node.latency ? `${node.latency}ms` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap" style={{ fontSize: '16px', color: 'rgb(114, 114, 114)', lineHeight: '1.5em' }}>
                  {node.reputation ? `${node.reputation}/100` : 'N/A'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

