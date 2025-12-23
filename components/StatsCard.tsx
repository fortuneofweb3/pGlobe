import React from 'react';
import AnimatedNumber from './AnimatedNumber';

interface StatsCardProps {
  title: string;
  value: number | string | React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string; // Additional classes
  subValue?: React.ReactNode;
  color?: 'orange' | 'green' | 'blue' | 'red'; // Theme color
}

export default function StatsCard({
  title,
  value,
  icon,
  loading = false,
  className,
  subValue,
  color = 'orange'
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
    }
  };

  const theme = colorStyles[color];

  if (loading) {
    return (
      <div className={`card-stat bg-[#0a0a0a] border-white/5 backdrop-blur-md overflow-hidden ${className || ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-bold">
            {title}
          </span>
          {icon && <div className="text-foreground/20">{icon}</div>}
        </div>
        <div className="h-8 w-24 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`card-stat bg-[#0a0a0a] border-white/5 backdrop-blur-md overflow-hidden group hover:bg-[#111] ${theme.hoverBorder} transition-all duration-300 ${className || ''}`}>
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
