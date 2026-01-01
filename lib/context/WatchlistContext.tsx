'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface WatchlistContextType {
    watchlist: string[];
    addToWatchlist: (pubkey: string) => void;
    removeFromWatchlist: (pubkey: string) => void;
    toggleWatchlist: (pubkey: string) => void;
    isWatched: (pubkey: string) => boolean;
    clearWatchlist: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

const STORAGE_KEY = 'xandeum_watchlist';

export function WatchlistProvider({ children }: { children: ReactNode }) {
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        setWatchlist(parsed);
                    }
                }
            } catch (err) {
                console.error('Failed to load watchlist from localStorage:', err);
            } finally {
                setIsInitialized(true);
            }
        }
    }, []);

    // Sync to localStorage
    useEffect(() => {
        if (isInitialized && typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
            } catch (err) {
                console.error('Failed to save watchlist to localStorage:', err);
            }
        }
    }, [watchlist, isInitialized]);

    const addToWatchlist = useCallback((pubkey: string) => {
        setWatchlist((prev) => {
            if (prev.includes(pubkey)) return prev;
            return [...prev, pubkey];
        });
    }, []);

    const removeFromWatchlist = useCallback((pubkey: string) => {
        setWatchlist((prev) => prev.filter((id) => id !== pubkey));
    }, []);

    const toggleWatchlist = useCallback((pubkey: string) => {
        setWatchlist((prev) => {
            if (prev.includes(pubkey)) {
                return prev.filter((id) => id !== pubkey);
            }
            return [...prev, pubkey];
        });
    }, []);

    const isWatched = useCallback(
        (pubkey: string) => {
            return watchlist.includes(pubkey);
        },
        [watchlist]
    );

    const clearWatchlist = useCallback(() => {
        setWatchlist([]);
    }, []);

    return (
        <WatchlistContext.Provider
            value={{
                watchlist,
                addToWatchlist,
                removeFromWatchlist,
                toggleWatchlist,
                isWatched,
                clearWatchlist,
            }}
        >
            {children}
        </WatchlistContext.Provider>
    );
}

export function useWatchlist() {
    const context = useContext(WatchlistContext);
    if (context === undefined) {
        throw new Error('useWatchlist must be used within a WatchlistProvider');
    }
    return context;
}
