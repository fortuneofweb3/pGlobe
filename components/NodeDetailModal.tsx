'use client';

import { PNode } from '@/lib/types/pnode';
import { useEffect } from 'react';
import { formatStorageBytes } from '@/lib/utils/storage';
import { X } from 'lucide-react';

interface NodeDetailModalProps {
  node: PNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NodeDetailModal({ node, isOpen, onClose }: NodeDetailModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !node) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return formatStorageBytes(bytes);
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-custom-16 text-custom-18';
      case 'offline':
        return 'bg-custom-21 text-custom-24';
      case 'syncing':
        return 'bg-custom-6 text-custom-9';
      default:
        return 'bg-custom-21 text-custom-24';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Node Details</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full font-body-small font-medium ${getStatusColor(node.status)}`}>
              {node.status || 'unknown'}
            </span>
            <span className="font-body-medium text-muted-foreground">
              Last seen: {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'N/A'}
            </span>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Node ID</p>
              <p className="font-body-medium font-mono text-text-title break-all">{node.id}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Public Key</p>
              <p className="font-body-medium font-mono text-text-title break-all">{node.publicKey || node.pubkey || 'N/A'}</p>
            </div>
            {node.pubkey && node.pubkey !== node.publicKey && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Pubkey (from API)</p>
                <p className="font-body-medium font-mono text-text-title break-all">{node.pubkey}</p>
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Address</p>
              <p className="text-sm font-medium text-foreground">{node.address || 'N/A'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Version</p>
              <p className="text-sm font-medium text-foreground">{node.version || 'N/A'}</p>
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                <p className="text-xl font-bold text-foreground">{formatPercentage(node.uptime)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Reputation</p>
                <p className="text-xl font-bold text-foreground">{node.reputation ? `${node.reputation}/100` : 'N/A'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Credits</p>
                <p className="text-xl font-bold text-foreground">{node.credits !== undefined ? node.credits.toLocaleString() : 'N/A'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Latency</p>
                <p className="text-xl font-bold text-foreground">{node.latency ? `${node.latency}ms` : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Storage Information */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Storage Information</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-body-medium text-muted-foreground">Total Capacity</span>
                <span className="font-body-medium font-medium text-text-title">{formatBytes(node.storageCapacity)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body-medium text-muted-foreground">Used</span>
                <span className="font-body-medium font-medium text-text-title">{formatBytes(node.storageUsed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body-medium text-muted-foreground">Available</span>
                <span className="font-body-medium font-medium text-text-title">
                  {formatBytes((node.storageCapacity || 0) - (node.storageUsed || 0))}
                </span>
              </div>
              {node.storageCapacity && node.storageUsed && (
                <div className="mt-4">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${((node.storageUsed / node.storageCapacity) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                  <p className="text-right mt-1 text-xs text-muted-foreground">
                    {((node.storageUsed / node.storageCapacity) * 100).toFixed(1)}% utilized
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {node.location && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Location</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium text-foreground">{node.location}</p>
              </div>
            </div>
          )}

          {/* All Response Fields */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">All Response Fields</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="space-y-3">
                {Object.entries(node)
                  .filter(([key]) => key !== '_raw') // Show all fields except _raw (we'll show that separately)
                  .map(([key, value]) => (
                    <div key={key} className="border-b border-border pb-2 last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm font-medium text-muted-foreground capitalize min-w-[120px]">
                          {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-sm font-medium text-foreground flex-1 text-right break-words">
                          {value === null || value === undefined ? (
                            <span className="text-muted-foreground italic">null</span>
                          ) : typeof value === 'object' ? (
                            <details className="inline-block text-left">
                              <summary className="cursor-pointer text-fill-accent-2 hover:text-fill-accent-1">
                                View {Array.isArray(value) ? `Array (${value.length})` : 'Object'}
                              </summary>
                              <pre className="mt-2 text-xs bg-card dark:bg-muted p-3 rounded border border-border overflow-x-auto max-h-64 overflow-y-auto">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            </details>
                          ) : typeof value === 'boolean' ? (
                            <span className={value ? 'text-green-500' : 'text-red-500'}>
                              {String(value)}
                            </span>
                          ) : typeof value === 'number' ? (
                            <span className="font-mono">{value.toLocaleString()}</span>
                          ) : (
                            <span className="break-all">{String(value)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Raw API Response */}
          {node._raw && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Raw API Response</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <details className="cursor-pointer">
                  <summary className="font-body-small font-medium text-foreground mb-2">
                    View Complete Raw Response JSON
                  </summary>
                  <div className="mt-4">
                    <pre className="bg-card dark:bg-muted p-4 rounded border border-border text-xs font-mono text-muted-foreground overflow-x-auto max-h-96 overflow-y-auto">
                        {JSON.stringify(node._raw, null, 2)}
                      </pre>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

