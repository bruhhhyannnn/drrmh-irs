'use client';

import { useEffect, useRef, useState } from 'react';
import { SeriesKey } from './grouped-bars';

const H = 220;
const PAD = { top: 24, right: 24, bottom: 8, left: 36 };

/**
 * Scores (0–100%) across a building's assessments #1…#n. The first line's values are printed at
 * every point; the others at their last point. `marker` (a linked event) is printed under its
 * point's label. A legend shows when there's more than one line.
 */
export function LineChart({
  points,
  lines,
  label,
}: {
  points: { label: string; sublabel?: string; marker?: string }[];
  lines: { id: string; name: string; color: string; values: (number | null)[] }[];
  label: string;
}) {
  // Drawn at the width it is shown at, so the 12px labels stay 12px on a phone.
  const box = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(240, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const n = points.length;
  const x = (i: number) =>
    n === 1
      ? (PAD.left + W - PAD.right) / 2
      : PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1);
  const y = (v: number) => PAD.top + ((100 - v) * (H - PAD.top - PAD.bottom)) / 100;

  return (
    <figure ref={box} className="flex flex-col gap-3" aria-label={label}>
      {lines.length > 1 && <SeriesKey series={lines} />}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--gray-500)"
            >
              {tick}%
            </text>
          </g>
        ))}
        {lines.map((line, li) => {
          const pts = line.values
            .map((v, i) => (v === null ? null : { x: x(i), y: y(v), v, i }))
            .filter((p) => p !== null);
          const last = pts[pts.length - 1];
          return (
            <g key={line.id}>
              {pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              )}
              {pts.map((p) => (
                <g key={p.i}>
                  <title>{`${line.name}, ${points[p.i].label}: ${p.v}%`}</title>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={line.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                  {(li === 0 || p === last) && (
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--gray-900)"
                    >
                      {p.v}%
                    </text>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="relative h-14">
        {points.map((p, i) => (
          <span
            key={p.label}
            className="absolute flex -translate-x-1/2 flex-col items-center text-center leading-tight"
            style={{
              left: `${(x(i) / W) * 100}%`,
              maxWidth: `${Math.max(72, (W - PAD.left - PAD.right) / n)}px`,
            }}
          >
            <span className="font-landing-mono text-[13px] font-semibold text-gray-900">
              {p.label}
            </span>
            {p.sublabel && <span className="text-[12px] text-gray-500">{p.sublabel}</span>}
            {p.marker && (
              <span className="line-clamp-1 text-[12px] font-medium text-brand-500">
                {p.marker}
              </span>
            )}
          </span>
        ))}
      </div>
    </figure>
  );
}
