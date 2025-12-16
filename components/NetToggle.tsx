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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F0A741]/10 text-[#F0A741] hover:bg-[#F0A741]/20 transition-all border border-[#F0A741]/30"
      >
        <span className="uppercase tracking-wider">{currentNet}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-black/95 backdrop-blur-md border border-[#F0A741]/30 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="py-1">
            {/* DevNet */}
            <button
              onClick={() => {
                onNetChange('devnet');
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#F0A741]/10 transition-colors group"
            >
              <div>
                <div className="text-xs font-semibold text-[#F0A741] uppercase tracking-wider">
                  DevNet
                </div>
                <div className="text-[10px] text-[#F0A741]/50 mt-0.5">
                  Test Network
                </div>
              </div>
              {currentNet === 'devnet' && (
                <Check className="w-3.5 h-3.5 text-[#F0A741]" />
              )}
            </button>

            {/* MainNet - Disabled */}
            <button
              disabled
              className="w-full px-3 py-2 text-left flex items-center justify-between opacity-40 cursor-not-allowed"
            >
              <div>
                <div className="text-xs font-semibold text-[#F0A741]/60 flex items-center gap-1.5 uppercase tracking-wider">
                  MainNet
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#F0A741]/20 rounded text-[#F0A741]/70 font-medium normal-case tracking-normal">
                    Soon
                  </span>
                </div>
                <div className="text-[10px] text-[#F0A741]/30 mt-0.5">
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

