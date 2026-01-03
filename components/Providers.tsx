'use client';

import { ReactNode } from 'react';
import { NodesProvider } from '@/lib/context/NodesContext';
import { UserRegionProvider } from '@/lib/context/UserRegionContext';
import { WatchlistProvider } from '@/lib/context/WatchlistContext';
import { NotificationProvider } from '@/lib/context/NotificationContext';

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <NodesProvider>
            <WatchlistProvider>
                <NotificationProvider>
                    <UserRegionProvider>
                        {children}
                    </UserRegionProvider>
                </NotificationProvider>
            </WatchlistProvider>
        </NodesProvider>
    );
}
