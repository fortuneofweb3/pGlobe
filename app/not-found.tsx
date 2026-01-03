'use client';

import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-foreground">
            <div className="text-center space-y-6 p-8">
                <div className="text-8xl font-bold text-[#F0A741] opacity-20">404</div>
                <h1 className="text-2xl font-bold text-foreground">Page Not Found</h1>
                <p className="text-foreground/60 max-w-md">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#F0A741] text-black font-semibold rounded-xl hover:bg-[#F0A741]/80 transition-colors"
                >
                    <Home className="w-4 h-4" />
                    Return Home
                </Link>
            </div>
        </div>
    );
}
