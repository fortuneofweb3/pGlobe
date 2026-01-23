'use client';

interface XandeumIconProps {
    className?: string;
    size?: number;
}

export default function XandeumIcon({ className = '', size = 16 }: XandeumIconProps) {
    return (
        <img
            src="/xand-token.png"
            alt="XAND"
            width={size}
            height={size}
            className={`inline-block align-middle ${className}`}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
        />
    );
}
