'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (value: number) => string;
}

// Parse formatted string into number part and unit part
// Handles cases like "655.66/s", "558833 ms", "0.99%", etc.
function parseFormattedString(str: string): { numberPart: string; unitPart: string } {
  // Remove leading/trailing whitespace
  str = str.trim();
  
  // Match the number part - digits, commas, periods, and spaces within the number
  // Stop at the first non-numeric, non-separator character (like letters, /, %, etc.)
  const numberMatch = str.match(/^([\d\s,.-]+?)(?=\s*[^\d\s,.-]|$)/);
  
  if (numberMatch) {
    const numberPart = numberMatch[1].trim();
    const unitPart = str.slice(numberMatch[0].length).trim();
    return { numberPart, unitPart };
  }
  
  // Fallback: if no match, treat entire string as number part
  return { numberPart: str, unitPart: '' };
}

export default function AnimatedNumber({
  value,
  duration = 600,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  formatter,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValueRef = useRef<number>(value);
  const digitRefs = useRef<Map<number, { container: HTMLSpanElement; old: HTMLSpanElement; new: HTMLSpanElement }>>(new Map());
  const targetValueRef = useRef<number>(value);

  // Format number to string
  const formatNumber = (num: number): string => {
    if (formatter) {
      return formatter(num);
    }

    if (decimals > 0) {
      return num.toFixed(decimals);
    }

    return Math.floor(num).toLocaleString('en-US');
  };

  useEffect(() => {
    if (value === previousValueRef.current) {
      return;
    }

    const currentFormatted = formatNumber(displayValue);
    const targetFormatted = formatNumber(value);
    targetValueRef.current = value;
    
    if (currentFormatted === targetFormatted) {
      setDisplayValue(value);
      previousValueRef.current = value;
      return;
    }

    setIsAnimating(true);

    // Animate each digit that changed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const currentParsed = parseFormattedString(currentFormatted);
        const targetParsed = parseFormattedString(targetFormatted);
        
        // Remove all non-digit characters for comparison
        const currentDigits = currentParsed.numberPart.replace(/[^0-9]/g, '');
        const targetDigits = targetParsed.numberPart.replace(/[^0-9]/g, '');
        
        // Find which digit positions changed
        const maxLength = Math.max(currentDigits.length, targetDigits.length);
        
        for (let i = 0; i < maxLength; i++) {
          const currentDigit = currentDigits[i] || '0';
          const targetDigit = targetDigits[i] || '0';
          
          if (currentDigit !== targetDigit) {
            const digitData = digitRefs.current.get(i);
            
            if (digitData && digitData.old && digitData.new) {
              // Update new digit value
              digitData.new.textContent = targetDigit;
              
              // Animate old digit up and out
              digitData.old.style.transform = 'translateY(-100%)';
              digitData.old.style.opacity = '0';
              
              // Animate new digit in from below
              digitData.new.style.transform = 'translateY(0)';
              digitData.new.style.opacity = '1';
            }
          }
        }

        // Update display value after animation completes
        setTimeout(() => {
          setDisplayValue(value);
          setIsAnimating(false);
          previousValueRef.current = value;
          
          // Reset positions for next animation
          digitRefs.current.forEach((data) => {
            if (data.old && data.new) {
              data.old.style.transform = 'translateY(0)';
              data.old.style.opacity = '1';
              data.new.style.transform = 'translateY(100%)';
              data.new.style.opacity = '0';
            }
          });
        }, duration);
      });
    });
  }, [value, duration, decimals, formatter, displayValue]);

  const formattedValue = formatNumber(displayValue);
  const targetFormatted = formatNumber(targetValueRef.current);
  const { numberPart, unitPart } = parseFormattedString(formattedValue);
  const targetParsed = parseFormattedString(targetFormatted);
  
  // Extract just digits from number part for animation
  const digits = numberPart.replace(/[^0-9]/g, '');
  const targetDigits = targetParsed.numberPart.replace(/[^0-9]/g, '');
  
  // Build the number display with separators in the correct positions
  // We need to reconstruct the number part with commas, periods, etc. in the right places
  const buildNumberDisplay = (numStr: string, targetNumStr: string) => {
    const result: Array<{ type: 'digit' | 'separator'; value: string; digitIndex?: number }> = [];
    let digitIndex = 0;
    
    // Use the target format as the template (it has the correct structure)
    for (let i = 0; i < targetNumStr.length; i++) {
      const char = targetNumStr[i];
      if (/[0-9]/.test(char)) {
        // Use the current digit value for display
        const digit = numStr[digitIndex] || '0';
        result.push({ type: 'digit', value: digit, digitIndex });
        digitIndex++;
      } else {
        // Separator (comma, period, space)
        result.push({ type: 'separator', value: char });
      }
    }
    
    return result;
  };

  const numberDisplay = buildNumberDisplay(digits, targetParsed.numberPart);
  
  // Combine unitPart from formatter with suffix prop (suffix takes precedence if both exist)
  const finalUnit = suffix || unitPart;

  return (
    <span className={`inline-flex items-end ${className}`} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {prefix && <span className="inline-block">{prefix}</span>}
      <span className="inline-flex items-end">
        {numberDisplay.map((item, idx) => {
          if (item.type === 'separator') {
            return (
              <span 
                key={`sep-${idx}`}
                className="inline-block"
                style={{
                  lineHeight: '1',
                }}
              >
                {item.value}
              </span>
            );
          }
          
          // It's a digit
          const digitIndex = item.digitIndex!;
          const targetDigit = targetDigits[digitIndex] || item.value;
          
          return (
            <span
              key={`digit-${digitIndex}`}
              ref={(el) => {
                if (el) {
                  const oldEl = el.querySelector('[data-old-digit]') as HTMLSpanElement;
                  const newEl = el.querySelector('[data-new-digit]') as HTMLSpanElement;
                  if (oldEl && newEl) {
                    digitRefs.current.set(digitIndex, {
                      container: el,
                      old: oldEl,
                      new: newEl,
                    });
                  }
                }
              }}
              className="inline-block relative overflow-hidden"
              style={{
                height: '1em',
                lineHeight: '1',
                minWidth: '0.6em',
                width: '0.6em',
                textAlign: 'center',
                display: 'inline-block',
              }}
            >
              {/* Old digit (current value) */}
              <span
                data-old-digit
                className="absolute inset-0 flex items-end justify-center"
                style={{
                  transform: 'translateY(0)',
                  opacity: 1,
                  transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms ease-out`,
                  lineHeight: '1',
                }}
              >
                {item.value}
              </span>
              
              {/* New digit (target value, starts below) */}
              <span
                data-new-digit
                className="absolute inset-0 flex items-end justify-center"
                style={{
                  transform: 'translateY(100%)',
                  opacity: 0,
                  transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms ease-out`,
                  lineHeight: '1',
                }}
              >
                {targetDigit}
              </span>
            </span>
          );
        })}
      </span>
      {/* Unit part (ms, %, /s, etc.) - render as single unit with proper spacing */}
      {finalUnit && (
        <span className="inline-block ml-0.5" style={{ lineHeight: '1' }}>
          {finalUnit}
        </span>
      )}
    </span>
  );
}
