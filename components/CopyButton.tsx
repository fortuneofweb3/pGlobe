'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
    value: string;
    className?: string;
}

export default function CopyButton({ value, className = "" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={`p-1.5 hover:bg-white/10 rounded-md transition-all active:scale-90 group/copy ${className}`}
            title="Copy to clipboard"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={2.5} />
            ) : (
                <Copy className="w-3.5 h-3.5 text-foreground/40 group-hover/copy:text-foreground/70 transition-colors" />
            )}
        </button>
    );
}
