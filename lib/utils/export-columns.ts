import { ColumnDef } from '@/components/ExportButton';
import { PNode } from '@/lib/types/pnode';
import { Manager } from '@/lib/context/NodesContext';

export const PNODE_EXPORT_COLUMNS: ColumnDef<PNode>[] = [
    { header: 'ID', accessorKey: 'id' },
    { header: 'Public Key', accessorKey: 'publicKey' },
    { header: 'Address', accessorKey: 'address' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Uptime (s)', accessorKey: 'uptime' },
    { header: 'Uptime (%)', accessorFn: (node) => node.uptimePercent ? node.uptimePercent.toFixed(2) : '' },
    { header: 'CPU (%)', accessorFn: (node) => node.cpuPercent ? node.cpuPercent.toFixed(2) : '' },
    { header: 'RAM Utilized (%)', accessorFn: (node) => node.ramPercent ? node.ramPercent.toFixed(2) : '' },
    { header: 'RAM Used (GB)', accessorFn: (node) => node.ramUsed ? (node.ramUsed / (1024 * 1024 * 1024)).toFixed(2) : '' },
    { header: 'RAM Total (GB)', accessorFn: (node) => node.ramTotal ? (node.ramTotal / (1024 * 1024 * 1024)).toFixed(2) : '' },
    { header: 'Storage Used (GB)', accessorFn: (node) => node.storageUsed ? (node.storageUsed / (1024 * 1024 * 1024)).toFixed(2) : '' },
    {
        header: 'Storage Capacity (GB)',
        accessorFn: (node) => node.storageCapacity ? (node.storageCapacity / (1024 * 1024 * 1024)).toFixed(2) : ''
    },
    { header: 'Active Streams', accessorKey: 'activeStreams' },
    { header: 'Version', accessorKey: 'version' },
    { header: 'Location', accessorKey: 'location' },
    { header: 'Country', accessorFn: (node) => node.locationData?.country || '' },
    { header: 'City', accessorFn: (node) => node.locationData?.city || '' },
    { header: 'Latency (ms)', accessorKey: 'latency' },
    { header: 'Credits', accessorKey: 'credits' },
    { header: 'Packets Rx', accessorKey: 'packetsReceived' },
    { header: 'Packets Tx', accessorKey: 'packetsSent' },
    { header: 'Data Ops Handled', accessorKey: 'dataOperationsHandled' },
    { header: 'Is Public', accessorFn: (node) => node.isPublic ? 'Yes' : 'No' },
    { header: 'Registered', accessorFn: (node) => node.isRegistered ? 'Yes' : 'No' },
    { header: 'Manager Wallet', accessorKey: 'managerWallet' },
    { header: 'Is Merged', accessorFn: (node) => node.isMerged ? 'Yes' : 'No' },
    { header: 'Merged IPs Count', accessorFn: (node) => node.mergedIPs ? node.mergedIPs.length : 0 },
    {
        header: 'Merged IPs List',
        accessorFn: (node) => node.mergedIPs ? node.mergedIPs.map(ip => ip.address).join('; ') : ''
    },
];

export const MANAGER_EXPORT_COLUMNS: ColumnDef<Manager>[] = [
    { header: 'Wallet', accessorKey: 'wallet' },
    { header: 'Registered Nodes', accessorKey: 'registeredNodes' },
    { header: 'Purchased Nodes', accessorKey: 'purchasedNodes' },
    { header: 'Online Nodes', accessorKey: 'onlineCount' },
    {
        header: 'Offline Nodes (Est)',
        accessorFn: (m) => (m.registeredNodes || 0) - (m.onlineCount || 0)
    },
    {
        header: 'Total Uptime (s)',
        accessorFn: (m: any) => m.totalUptimeSeconds
    },
    { header: 'Total Credits', accessorKey: 'totalCredits' },
    { header: 'Vesting Stake', accessorKey: 'vestingStake' },
    { header: 'DAO Stake', accessorKey: 'daoStake' },
    {
        header: 'Total Storage (GB)',
        accessorFn: (m: any) => m.totalStorage ? (m.totalStorage / (1024 * 1024 * 1024)).toFixed(2) : '0'
    },
    { header: 'Known Nodes Count', accessorFn: (m) => m.knownNodes?.length || 0 },
];

export const HISTORY_EXPORT_COLUMNS: ColumnDef<any>[] = [
    { header: 'Timestamp', accessorFn: (item: any) => new Date(item.timestamp).toISOString() },
    { header: 'Status', accessorKey: 'status' },
    { header: 'CPU (%)', accessorFn: (item: any) => item.cpuPercent !== undefined ? item.cpuPercent.toFixed(2) : '' },
    { header: 'RAM (%)', accessorFn: (item: any) => item.ramPercent !== undefined ? item.ramPercent.toFixed(2) : '' },
    { header: 'Packets Rx', accessorKey: 'packetsReceived' },
    { header: 'Packets Tx', accessorKey: 'packetsSent' },
    { header: 'Credits', accessorKey: 'credits' },
    { header: 'Uptime (s)', accessorKey: 'uptime' }
];

export const NETWORK_HISTORY_COLUMNS: ColumnDef<any>[] = [
    { header: 'Timestamp', accessorFn: (item: any) => new Date(item.timestamp).toISOString() },
    { header: 'Online Nodes', accessorKey: 'onlineCount' },
    { header: 'Total Nodes', accessorKey: 'totalNodes' },
    { header: 'Network Score', accessorKey: 'networkHealthScore' },
    { header: 'Availability Score', accessorKey: 'networkHealthAvailability' },
    { header: 'Version Score', accessorKey: 'networkHealthVersion' },
    { header: 'Distribution Score', accessorKey: 'networkHealthDistribution' }
];
