'use client';

import { useNotifications, Notification } from '@/lib/context/NotificationContext';
import { X, Bell, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const iconMap = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
};

const colorMap = {
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-[#F0A741] bg-[#F0A741]/10 border-[#F0A741]/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function Toast({ notification }: { notification: Notification }) {
    const { removeNotification } = useNotifications();
    const Icon = iconMap[notification.type];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            layout
            className={`min-w-[320px] max-w-md p-4 rounded-xl border shadow-lg backdrop-blur-md ${colorMap[notification.type]} flex gap-3 group`}
        >
            <div className="flex-shrink-0 mt-0.5">
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground leading-tight">{notification.title}</h4>
                <p className="text-xs text-foreground/70 mt-1 leading-relaxed">{notification.message}</p>
            </div>
            <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

export default function NotificationContainer() {
    const { notifications } = useNotifications();

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <div key={n.id} className="pointer-events-auto">
                        <Toast notification={n} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}
