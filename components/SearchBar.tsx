'use client';

import { Search, X } from 'lucide-react';
import { ReactNode, RefObject } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
  onClear?: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement>;
  children?: ReactNode; // For dropdown results
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search by IP, public key, or location...',
  className = '',
  showClearButton = false,
  onClear,
  onFocus,
  inputRef,
  children,
}: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-sm sm:text-base bg-card/50 border border-border/60 rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-border transition-all"
        />
        {showClearButton && value && (
          <button
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            className="absolute right-3 p-1 hover:bg-muted/30 rounded transition-colors"
          >
            <X className="w-4 h-4 text-foreground/40" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

