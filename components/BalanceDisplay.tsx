'use client';

import SolanaDevnetIcon from './SolanaDevnetIcon';

interface BalanceDisplayProps {
  balance: number | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export default function BalanceDisplay({ balance, className = '', showIcon = true }: BalanceDisplayProps) {
  if (balance === null || balance === undefined) {
    return <span className={className}>N/A</span>;
  }
  
  // Format balance with appropriate decimal places
  let formattedValue: string;
  if (balance === 0) {
    formattedValue = '0';
  } else if (balance < 0.001) {
    // Very small balances: show up to 9 decimals (lamport precision)
    formattedValue = balance.toFixed(9).replace(/\.?0+$/, '');
  } else if (balance < 1) {
    // Small balances: show up to 6 decimals
    formattedValue = balance.toFixed(6).replace(/\.?0+$/, '');
  } else {
    // Normal balances: show up to 3 decimals
    formattedValue = balance.toFixed(3).replace(/\.?0+$/, '');
  }
  
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{formattedValue}</span>
      {showIcon && <SolanaDevnetIcon size={16} className="flex-shrink-0" />}
    </span>
  );
}

