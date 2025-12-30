/**
 * Hook to fetch XAND token price from CoinGecko API
 */
import { useState, useEffect } from 'react';

// Cache price for 60 seconds to avoid excessive API calls
let cachedPrice: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 60 seconds

export function useXandPrice() {
    const [price, setPrice] = useState<number | null>(cachedPrice);
    const [loading, setLoading] = useState(!cachedPrice);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Use cached price if still valid
        if (cachedPrice && Date.now() - cacheTimestamp < CACHE_DURATION) {
            setPrice(cachedPrice);
            setLoading(false);
            return;
        }

        const fetchPrice = async () => {
            try {
                setLoading(true);
                // CoinGecko Free API
                const response = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=xandeum&vs_currencies=usd'
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch price');
                }

                const data = await response.json();

                if (data.xandeum?.usd) {
                    const priceValue = data.xandeum.usd;
                    cachedPrice = priceValue;
                    cacheTimestamp = Date.now();
                    setPrice(priceValue);
                    setError(null);
                } else {
                    setError('Price not available');
                }
            } catch (err) {
                console.error('Failed to fetch XAND price:', err);
                setError('Failed to fetch price');
            } finally {
                setLoading(false);
            }
        };

        fetchPrice();
    }, []);

    // Helper to format USD values - full amount with 2 decimal places
    const formatUsd = (xandAmount: number): string => {
        if (!price || price === 0) return '';
        const usdValue = xandAmount * price;
        return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return { price, loading, error, formatUsd };
}
