'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface NetToggleProps {
  currentNet: 'devnet' | 'mainnet';
  onNetChange: (net: 'devnet' | 'mainnet') => void;
}

export default function NetToggle({ currentNet, onNetChange }: NetToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#F0A741]/10 text-[#F0A741] hover:bg-[#F0A741]/20 transition-all border border-[#F0A741]/20"
      >
        <span className="uppercase tracking-wide">{currentNet}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-black/95 backdrop-blur-md border border-[#F0A741]/20 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="py-1">
            {/* DevNet */}
            <button
              onClick={() => {
                onNetChange('devnet');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-[#F0A741]/10 transition-colors group"
            >
              <div>
                <div className="text-sm font-medium text-[#F0A741] group-hover:text-[#F0A741]">
                  DevNet
                </div>
                <div className="text-xs text-[#F0A741]/60 mt-0.5">
                  Test Network
                </div>
              </div>
              {currentNet === 'devnet' && (
                <Check className="w-4 h-4 text-[#F0A741]" />
              )}
            </button>

            {/* MainNet - Disabled */}
            <button
              disabled
              className="w-full px-4 py-2.5 text-left flex items-center justify-between opacity-50 cursor-not-allowed"
            >
              <div>
                <div className="text-sm font-medium text-[#F0A741]/60 flex items-center gap-2">
                  MainNet
                  <span className="text-xs px-1.5 py-0.5 bg-[#F0A741]/20 rounded text-[#F0A741]/80 font-normal">
                    Coming Soon
                  </span>
                </div>
                <div className="text-xs text-[#F0A741]/40 mt-0.5">
                  Production Network
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

