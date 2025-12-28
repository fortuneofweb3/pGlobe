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
function parseFormattedString(str: string): { numberPart: string; unitPart: string } {
  str = str.trim();
  const numberMatch = str.match(/^([\d\s,.-]+?)(?=\s*[^\d\s,.-]|$)/);

  if (numberMatch) {
    const numberPart = numberMatch[1].trim();
    const unitPart = str.slice(numberMatch[0].length).trim();
    return { numberPart, unitPart };
  }

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
  const previousValueRef = useRef<number>(value);
  const targetValueRef = useRef<number>(value);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<'up' | 'down'>('up');

  // Refs for tracking digit elements
  const digitRefs = useRef<Map<string, { old: HTMLSpanElement; new: HTMLSpanElement }>>(new Map());

  // Format number to string
  const formatNumber = (num: number): string => {
    if (formatter) return formatter(num);
    const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    return num.toLocaleString('en-US', options);
  };

  useEffect(() => {
    // Determine direction and update target
    if (value === previousValueRef.current) return;

    const isIncreasing = value > previousValueRef.current;
    directionRef.current = isIncreasing ? 'up' : 'down';

    const currentFormatted = formatNumber(displayValue);
    const targetFormatted = formatNumber(value);

    // Skip if visual representation hasn't changed
    if (currentFormatted === targetFormatted) {
      previousValueRef.current = value;
      targetValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    // Clear any pending animation cleanup
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    targetValueRef.current = value;

    // Trigger animation in next frames
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Double check target hasn't changed
        if (targetValueRef.current !== value) return;

        const currentParsed = parseFormattedString(currentFormatted);
        const targetParsed = parseFormattedString(targetFormatted);

        const currentNumPart = currentParsed.numberPart;
        const targetNumPart = targetParsed.numberPart;

        // Alignment logic: align relative to decimal point or right end
        const getAlignmentKey = (numStr: string, charIdx: number) => {
          const dotIdx = numStr.indexOf('.');
          if (dotIdx === -1) {
            // No dot: key is distance from right
            return `r-${numStr.length - 1 - charIdx}`;
          }
          // With dot: key is distance from dot
          return `d-${charIdx - dotIdx}`;
        };

        // Update digit elements that changed
        for (let i = 0; i < targetNumPart.length; i++) {
          const char = targetNumPart[i];
          if (!/[0-9]/.test(char)) continue;

          const key = getAlignmentKey(targetNumPart, i);
          const digitData = digitRefs.current.get(key);
          if (!digitData) continue;

          // Find what the old digit was for this same position key
          let oldChar = '0';
          for (let j = 0; j < currentNumPart.length; j++) {
            if (getAlignmentKey(currentNumPart, j) === key) {
              oldChar = currentNumPart[j];
              break;
            }
          }

          if (oldChar !== char) {
            digitData.new.textContent = char;

            // 1. Reset state without transition to guarantee start position
            digitData.old.style.transition = 'none';
            digitData.new.style.transition = 'none';

            digitData.old.style.transform = 'translateY(0)';
            digitData.old.style.opacity = '1';

            if (directionRef.current === 'up') {
              digitData.new.style.transform = 'translateY(100%)';
            } else {
              digitData.new.style.transform = 'translateY(-100%)';
            }
            digitData.new.style.opacity = '0';

            // 2. Force reflow to ensure the browser registers the reset
            void digitData.new.offsetWidth;

            // 3. Apply transition and target state
            const transitionStyle = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${duration}ms ease-out`;
            digitData.old.style.transition = transitionStyle;
            digitData.new.style.transition = transitionStyle;

            if (directionRef.current === 'up') {
              digitData.old.style.transform = 'translateY(-100%)';
              digitData.old.style.opacity = '0';
              digitData.new.style.transform = 'translateY(0)';
              digitData.new.style.opacity = '1';
            } else {
              digitData.old.style.transform = 'translateY(100%)';
              digitData.old.style.opacity = '0';
              digitData.new.style.transform = 'translateY(0)';
              digitData.new.style.opacity = '1';
            }
          }
        }

        // Cleanup after animation
        animationTimeoutRef.current = setTimeout(() => {
          if (targetValueRef.current === value) {
            // Disable transitions before reset to prevent "sliding back"
            digitRefs.current.forEach((data) => {
              data.old.style.transition = 'none';
              data.new.style.transition = 'none';
            });

            setDisplayValue(value);
            previousValueRef.current = value;

            // Reset transforms for next cycle
            digitRefs.current.forEach((data) => {
              data.old.style.transform = 'translateY(0)';
              data.old.style.opacity = '1';
              data.new.style.transform = directionRef.current === 'up' ? 'translateY(100%)' : 'translateY(-100%)';
              data.new.style.opacity = '0';
            });
          }
        }, duration);
      });
    });

    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, [value, duration, decimals, formatter]);

  const currentFormatted = formatNumber(displayValue);
  const targetFormatted = formatNumber(targetValueRef.current);
  const currentParsed = parseFormattedString(currentFormatted);
  const targetParsed = parseFormattedString(targetFormatted);

  const buildNumberDisplay = () => {
    const result: Array<{ type: 'digit' | 'separator'; value: string; key: string }> = [];
    const template = targetParsed.numberPart;
    const currentNumPart = currentParsed.numberPart;

    const getAlignmentKey = (numStr: string, charIdx: number) => {
      const dotIdx = numStr.indexOf('.');
      if (dotIdx === -1) return `r-${numStr.length - 1 - charIdx}`;
      return `d-${charIdx - dotIdx}`;
    };

    for (let i = 0; i < template.length; i++) {
      const char = template[i];
      const key = getAlignmentKey(template, i);

      if (/[0-9]/.test(char)) {
        // Find current value for this position
        let currentVal = '0';
        for (let j = 0; j < currentNumPart.length; j++) {
          if (getAlignmentKey(currentNumPart, j) === key) {
            currentVal = currentNumPart[j];
            break;
          }
        }
        result.push({ type: 'digit', value: currentVal, key });
      } else {
        result.push({ type: 'separator', value: char, key });
      }
    }
    return result;
  };

  const numberDisplay = buildNumberDisplay();
  const targetNumPart = targetParsed.numberPart;
  const finalUnit = suffix || targetParsed.unitPart;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {/* Hidden for copy */}
      <span className="sr-only" aria-live="polite">{prefix}{targetFormatted}{finalUnit}</span>

      {prefix && <span className="select-none">{prefix}</span>}

      <span className="inline-flex select-none">
        {numberDisplay.map((item, idx) => {
          if (item.type === 'separator') {
            return <span key={`sep-${idx}`} className="leading-none">{item.value}</span>;
          }

          const targetChar = targetNumPart.split('').find((_, i) => {
            const dotIdx = targetNumPart.indexOf('.');
            const key = dotIdx === -1 ? `r-${targetNumPart.length - 1 - i}` : `d-${i - dotIdx}`;
            return key === item.key;
          }) || '0';

          return (
            <span
              key={`digit-${item.key}`}
              ref={(el) => {
                if (el) {
                  const oldEl = el.querySelector('[data-old]') as HTMLSpanElement;
                  const newEl = el.querySelector('[data-new]') as HTMLSpanElement;
                  if (oldEl && newEl) digitRefs.current.set(item.key, { old: oldEl, new: newEl });
                }
              }}
              className="inline-block relative overflow-hidden"
              style={{
                height: '1.2em',
                width: '0.6em',
                textAlign: 'center',
                verticalAlign: 'baseline'
              }}
            >
              <span
                data-old
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transition: 'none',
                }}
              >
                {item.value}
              </span>
              <span
                data-new
                className="absolute inset-0 flex items-center justify-center opacity-0"
                style={{
                  transform: directionRef.current === 'up' ? 'translateY(100%)' : 'translateY(-100%)',
                  transition: 'none',
                }}
              >
                {targetChar}
              </span>
            </span>
          );
        })}
      </span>

      {finalUnit && <span className="ml-0.5 select-none">{finalUnit}</span>}
    </span>
  );
}
