/**
 * Author: Cascade
 * Date: 2026-01-07T03:45:00Z
 * PURPOSE: Retro visitor counter component with oversized typography so the landing page can
 *          spotlight real traffic while preserving the GeoCities flair and clicky badges.
 * SRP/DRY check: Pass — encapsulates fetch + rendering logic in one component reused by pages.
 */
import React, { useEffect, useState } from 'react';
export function VisitorCounter({ page = 'landing' }: { page?: string }) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        // Increment and fetch count on mount
        const updateCounter = async () => {
            try {
                const response = await fetch('/api/visitor-counter/increment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ page }),
                });
                const data = await response.json();
                if (data.success) {
                    setCount(data.data.count);
                }
            } catch (err) {
                console.error('Failed to update visitor counter:', err);
            }
        };

        updateCounter();
    }, [page]);

    if (count === null) return null;

    // Pad counter to 6 digits
    const paddedCount = count.toString().padStart(6, '0');

    return (
        <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex items-center gap-1 font-mono text-2xl sm:text-3xl font-black bg-black p-3 border-4 border-slate-700 shadow-[inset_2px_2px_0_rgba(255,255,255,0.3),inset_-2px_-2px_0_rgba(0,0,0,0.5)]">
                {paddedCount.split('').map((digit, i) => (
                    <div
                        key={i}
                        className="w-10 h-14 flex items-center justify-center bg-slate-900 text-lime-400 border border-slate-800 shadow-[inset_1px_1px_3px_rgba(0,0,0,1)] text-3xl"
                    >
                        {digit}
                    </div>
                ))}
            </div>
            <div className="text-base sm:text-lg font-black tracking-[0.6em] text-slate-200 uppercase">
                Visitors since launch
            </div>
            {/* 90s Web Flair */}
            <div className="flex gap-4 opacity-70 grayscale hover:grayscale-0 transition-all">
                <div className="border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] text-white font-bold">
                    MADE WITH <span className="text-sky-400">NOTEPAD</span>
                </div>
                <div className="border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] text-white font-serif italic">
                    Best viewed in <span className="text-orange-400 font-bold">Netscape Navigator 4.0</span>
                </div>
            </div>
        </div>
    );
}
