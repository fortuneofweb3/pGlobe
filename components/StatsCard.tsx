import React from 'react';
import AnimatedNumber from './AnimatedNumber';

interface StatsCardProps {
  title: string;
  value: number | string | React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string; // Additional classes
  subValue?: React.ReactNode;
  color?: 'orange' | 'green' | 'blue' | 'red' | 'emerald' | 'purple' | 'gray'; // Theme color
  onClick?: () => void; // Optional click handler
}

export default function StatsCard({
  title,
  value,
  icon,
  loading = false,
  className,
  subValue,
  color = 'orange',
  onClick
}: StatsCardProps) {
  // Color mappings based on app/regions/[country]/page.tsx
  const colorStyles = {
    orange: {
      hoverBorder: 'hover:border-[#F0A741]/20',
      groupHoverText: 'group-hover:text-[#F0A741]',
      iconColor: 'text-[#F0A741]',
      blurBg: 'bg-[#F0A741]/5',
      blurGroupHoverBg: 'group-hover:bg-[#F0A741]/10'
    },
    green: {
      hoverBorder: 'hover:border-[#3F8277]/20',
      groupHoverText: 'group-hover:text-[#3F8277]',
      iconColor: 'text-[#3F8277]',
      blurBg: 'bg-[#3F8277]/5',
      blurGroupHoverBg: 'group-hover:bg-[#3F8277]/10'
    },
    blue: {
      hoverBorder: 'hover:border-[#3b82f6]/20',
      groupHoverText: 'group-hover:text-[#3b82f6]',
      iconColor: 'text-[#3b82f6]',
      blurBg: 'bg-[#3b82f6]/5',
      blurGroupHoverBg: 'group-hover:bg-[#3b82f6]/10'
    },
    red: {
      hoverBorder: 'hover:border-[#ef4444]/20',
      groupHoverText: 'group-hover:text-[#ef4444]',
      iconColor: 'text-[#ef4444]',
      blurBg: 'bg-[#ef4444]/5',
      blurGroupHoverBg: 'group-hover:bg-[#ef4444]/10'
    },
    emerald: {
      hoverBorder: 'hover:border-[#10b981]/20',
      groupHoverText: 'group-hover:text-[#10b981]',
      iconColor: 'text-[#10b981]',
      blurBg: 'bg-[#10b981]/5',
      blurGroupHoverBg: 'group-hover:bg-[#10b981]/10'
    },
    purple: {
      hoverBorder: 'hover:border-[#a855f7]/20',
      groupHoverText: 'group-hover:text-[#a855f7]',
      iconColor: 'text-[#a855f7]',
      blurBg: 'bg-[#a855f7]/5',
      blurGroupHoverBg: 'group-hover:bg-[#a855f7]/10'
    },
    gray: {
      hoverBorder: 'hover:border-[#6b7280]/20',
      groupHoverText: 'group-hover:text-[#6b7280]',
      iconColor: 'text-[#6b7280]',
      blurBg: 'bg-[#6b7280]/5',
      blurGroupHoverBg: 'group-hover:bg-[#6b7280]/10'
    }
  };

  const theme = colorStyles[color] || colorStyles.orange;

  if (loading) {
    return (
      <div className={`card-stat bg-[#0d0d0d] border-white/10 overflow-hidden ${className || ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-16 bg-muted/20 rounded" />
          {icon && <div className="w-3.5 h-3.5 bg-muted/10 rounded" />}
        </div>
        <div className="h-7 w-24 bg-muted/30 rounded mb-1" />
        {subValue && (
          <div className="h-2.5 w-16 bg-muted/10 rounded mt-1" />
        )}
        {/* Decorative blur circle placeholder */}
        <div className={`absolute -right-6 -bottom-6 w-12 h-12 ${theme.blurBg} rounded-full blur-xl opacity-50`} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`card-stat bg-[#0d0d0d] border-white/10 overflow-hidden group hover:bg-[#111] ${theme.hoverBorder} transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.03]' : ''} ${className || ''}`}
    >
      <div className="flex flex-col relative">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] uppercase tracking-widest text-foreground/40 font-bold ${theme.groupHoverText} transition-colors`}>
            {title}
          </span>
          {icon && (
            <div className={`w-3.5 h-3.5 ${theme.iconColor} opacity-50 group-hover:opacity-100 transition-opacity`}>
              {icon}
            </div>
          )}
        </div>

        <div className="text-xl sm:text-2xl font-bold font-mono text-foreground overflow-hidden text-ellipsis">
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} />
          ) : (
            value
          )}
        </div>

        {subValue && (
          <div className="text-[10px] text-foreground/40 font-bold mt-1">
            {subValue}
          </div>
        )}

        {/* Decorative blur circle */}
        <div className={`absolute -right-6 -bottom-6 w-12 h-12 ${theme.blurBg} rounded-full blur-xl ${theme.blurGroupHoverBg} transition-colors`} />
      </div>
    </div>
  );
}
