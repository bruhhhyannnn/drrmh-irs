'use client';

import { cn } from '@/lib';
import { useThemeStore } from '@/store';
import { ChevronRight, Inbox, School } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLandingData } from './use-landing-stats';

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { data } = useLandingData();

  const [navScrolled, setNavScrolled] = useState(false);

  const { theme } = useThemeStore();

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 650);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* hero stat cards */
  const heroStats = [
    {
      label: 'Active Events',
      value: data?.activeEvents,
      sub: 'Drills in progress',
      accent: true,
    },
    { label: 'Total Drills', value: data?.totalEvents, sub: 'Conducted since 2025' },
    { label: 'Clusters Covered', value: 4, sub: 'Pedro Gil · Padre Faura · Taft · SHS' },
  ];

  /* tab filter in feature 1 */
  const [activeTab, setActiveTab] = useState<'ongoing' | 'upcoming' | 'completed'>('ongoing');
  const filteredEvents = data?.events?.filter((ev) => ev.status?.name?.toLowerCase() === activeTab);

  /* smooth scroll */
  const smoothScroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* hero background images */
  const BG_IMAGES = [
    '/upm-drrmh-background-1.jpg',
    '/upm-drrmh-background-2.jpg',
    '/upm-drrmh-background-3.jpg',
    '/upm-drrmh-background-4.jpg',
  ];
  const track = [...BG_IMAGES, ...BG_IMAGES]; // doubled for seamless loop
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % track.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [track.length]);

  const eventsperstatus = [
    { status: 'ongoing', events: 1 },
    { status: 'completed', events: 2 },
    { status: 'upcoming', events: 3 },
  ];

  const colorperStatus: Record<string, string> = {
    ongoing: '#8B1A1A',
    upcoming: '#8A7868',
    completed: '#E8C97A',
    unknown: '#9ca3af',
  };

  const reportspercluster = [
    { cluster: 'ongoing', casualties: 0, missing: 2, reports: 4 },
    { cluster: 'ongoing', casualties: 1, missing: 1, reports: 3 },
    { cluster: 'ongoing', casualties: 1, missing: 1, reports: 4 },
  ];

  function EmptyState({ message }: { message: string }) {
    return (
      <div className="flex h-full min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-white/5">
        <Inbox className="mb-2 text-gray-300 dark:text-gray-600" size={24} />
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root {
          --maroon: #8B1A1A;
          --maroon-dark: #6B1313;
          --maroon-pale: #F9ECEC;
          --cream: #FAF8F5;
          --cream2: #F3EFE8;
          --border: rgba(139,26,26,0.1);
          --text-light: #FAF8F5;
          --text-dark: #1A1208;
          --text-mid: #4A3728;
          --text-muted: #8A7868;
          --gold-light: #E8C97A;
          
          --text-2xs: 11px;
          --text-xs: 12px;
          --text-sm: 14px;
          --text-base: 15px;
          --text-md: 16px;
          --text-lg: 17px;
          --text-xl: 19px;
          --text-2xl: 28px;
          --text-3xl: 36px;

          --text-quote:    clamp(18px, 2.8vw, 30px);    /* testimonial quote */
          --text-section:  clamp(28px, 4vw, 48px);      /* section headings */
          --text-cta:      clamp(28px, 5vw, 52px);      /* CTA heading */
          --text-hero-sub: clamp(15px, 2vw, 18px);      /* hero subtext */
          --text-hero:     clamp(44px, 7vw, 76px);      /* hero h1 */
        }

        html {
          scroll-behavior: smooth;
        }

        body { font-family: var(--font-sans); }

        .display { font-family: var(--font-sans); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        .hero-anim-0 { animation: fadeUp 0.7s ease both 0.1s; }
        .hero-anim-1 { animation: fadeUp 0.8s ease both 0.25s; }
        .hero-anim-2 { animation: fadeUp 0.8s ease both 0.4s; }
        .hero-anim-3 { animation: fadeUp 0.8s ease both 0.55s; }
        .hero-anim-4 { animation: fadeUp 1s  ease both 0.7s; }

        .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }

        .skeleton {
          background: linear-gradient(90deg, #E8E2D8 25%, #F3EFE8 50%, #E8E2D8 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
      `}</style>

      <div style={{ background: 'var(--cream)', color: 'var(--text-dark)', overflowX: 'hidden' }}>
        {/* ── NAV ── */}
        <nav
          className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-6 transition-all duration-300 lg:px-16"
          style={{
            height: '72px',
            background: navScrolled ? 'rgba(250,248,245,0.92)' : 'transparent',
            backdropFilter: navScrolled ? 'blur(16px)' : 'none',
            borderBottom: navScrolled ? '1px solid var(--border)' : '1px solid transparent',
          }}
        >
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <Image
              src="/irs-logo.png"
              alt="IRS Logo"
              width={38}
              height={38}
              sizes="38px"
              className="object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span
                className="font-semibold"
                style={{
                  color: navScrolled ? 'var(--text-dark)' : 'white',
                  fontSize: 'var(--text-sm)',
                }}
              >
                UPM DRRM-H
              </span>
              <span
                className="text-xs"
                style={{ color: navScrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.6)' }}
              >
                Incident Reporting System
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {[
              { href: '#features', label: 'Features' },
              { href: '#how-it-works', label: 'How It Works' },
              { href: '#about', label: 'About' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScroll(item.href.replace('#', ''));
                }}
                className="no-underline transition-colors duration-200"
                style={{
                  color: navScrolled ? 'var(--text-mid)' : 'rgba(255,255,255,0.85)',
                  fontSize: 'var(--text-base)',
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = navScrolled
                    ? 'var(--maroon)'
                    : 'var(--gold-light)')
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = navScrolled
                    ? 'var(--text-mid)'
                    : 'rgba(255,255,255,0.85)')
                }
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/signin"
              target="_blank"
              className="rounded-lg px-5 py-2.5 font-medium text-white no-underline transition-all duration-200 hover:-translate-y-px"
              style={{
                background: 'var(--maroon)',
                boxShadow: '0 4px 14px rgba(139,26,26,0.3)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Access System
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section
          className="relative flex flex-col items-center justify-center overflow-hidden text-center"
          style={{ paddingTop: 'calc(72px + 64px)', paddingBottom: '80px', minHeight: '100vh' }}
        >
          {/* radial glow */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: '-5%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '800px',
              height: '800px',
              background: 'radial-gradient(ellipse, rgba(139,26,26,0.07) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 mx-auto w-full max-w-5xl px-6">
            <div className="hero-anim-0 mb-8 flex flex-col flex-wrap items-center justify-center gap-2">
              {/* logo images */}
              <div className="mb-2 flex flex-wrap items-center justify-center gap-3">
                <Image
                  src="/up-logo.png"
                  alt="UP Manila Logo"
                  width={72}
                  height={72}
                  sizes="72px"
                  className="object-contain"
                />
                <Image
                  src="/upm-drrmh-logo.png"
                  alt="DRRM-H Logo"
                  width={72}
                  height={72}
                  sizes="72px"
                  className="object-contain"
                />
                <Image
                  src="/irs-logo.png"
                  alt="IRS Logo"
                  width={72}
                  height={72}
                  sizes="72px"
                  className="object-contain"
                />
              </div>
              {/* eyebrow */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--gold-light)' }}
                  />
                  <span
                    className="text-[13px] font-semibold tracking-wide text-white"
                    style={{ fontSize: 'var(--text-xl)' }}
                  >
                    University of the Philippines Manila
                  </span>
                </div>
                <span
                  className="font-light"
                  style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-lg)' }}
                >
                  Disaster Risk Reduction & Management in Health Program
                </span>
              </div>
            </div>

            {/* headline */}
            <h1
              className="display hero-anim-1 mb-6 font-normal tracking-tight"
              style={{
                fontSize: 'var(--text-hero)',
                lineHeight: 1.1,
                color: 'white',
              }}
            >
              Smarter incident reporting
              <br />
              for <em style={{ color: 'var(--gold-light)' }}>emergency response</em> teams
            </h1>

            {/* subtext */}
            <p
              className="hero-anim-2 mx-auto mb-10 font-light"
              style={{
                fontSize: 'var(--text-hero-sub)',
                color: 'rgba(255,255,255,0.75)',
                maxWidth: '560px',
                lineHeight: 1.7,
              }}
            >
              The Incident Reporting System automates documentation during emergency drills,
              generates real-time summaries, and helps evaluate ERT performance over time.
            </p>

            {/* CTAs */}
            <div className="hero-anim-3 mb-16 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/signin"
                target="_blank"
                className="rounded-[10px] px-7 py-3.5 font-medium text-white no-underline transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: 'var(--maroon)',
                  boxShadow: '0 4px 20px rgba(139,26,26,0.28)',
                  fontSize: 'var(--text-md)',
                }}
              >
                Access the System
              </Link>
              <a
                href="#features"
                className="rounded-[10px] flex items-center justify-center gap-2 border px-6 py-3.5 font-normal no-underline transition-all duration-200"
                style={{
                  color: 'var(--text-mid)',
                  borderColor: 'var(--border)',
                  background: 'rgba(255,255,255,0.6)',
                  fontSize: 'var(--text-md)',
                }}
              >
                Explore Features
                <ChevronRight size={14} />
              </a>
            </div>

            {/* ── Dashboard Preview ── */}
            <div
              className="hero-anim-4 w-full overflow-hidden rounded-[20px] text-left"
              style={{
                background: 'white',
                border: '1px solid rgba(139,26,26,0.1)',
                boxShadow: '0 24px 80px rgba(26,18,8,0.10), 0 0 0 1px rgba(255,255,255,0.5) inset',
              }}
            >
              {/* window bar */}
              <div
                className="flex items-center gap-2 px-4"
                style={{
                  height: '44px',
                  background: 'var(--cream2)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <span className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>

              <div className="grid grid-cols-1 gap-5 p-8 md:grid-cols-3">
                {/* stat cards */}
                {heroStats.map((s) => (
                  <StatCard key={s.label} {...s} />
                ))}

                {/* cluster progress */}
                <div
                  className="rounded-[14px] p-5 md:col-span-3"
                  style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                >
                  <p
                    className="mb-4 font-medium"
                    style={{ color: 'var(--text-mid)', fontSize: 'var(--text-sm)' }}
                  >
                    Drills by Cluster
                  </p>
                  <div className="flex flex-col gap-3">
                    {['Pedro Gil', 'Padre Faura', 'Taft', 'SHS', 'PGH'].map((name, i) => {
                      const staticPcts = [85, 70, 90, 60, 75];
                      const staticColors: Array<'maroon' | 'gold'> = [
                        'maroon',
                        'gold',
                        'maroon',
                        'gold',
                        'maroon',
                      ];
                      return (
                        <ProgressRow
                          key={name}
                          name={name}
                          pct={staticPcts[i]}
                          reports={Math.floor(staticPcts[i] / 20)}
                          color={staticColors[i]}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* events per status */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 col-span-3">
                  <div
                    className="rounded-[14px] p-4"
                    style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                  >
                    <p
                      className="mb-4 font-medium"
                      style={{ color: 'var(--text-mid)', fontSize: 'var(--text-sm)' }}
                    >
                      Events per Status
                    </p>
                    {eventsperstatus.length ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={eventsperstatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={5}
                            nameKey="status"
                            dataKey="events"
                            stroke="none"
                            cornerRadius={4}
                          >
                            {eventsperstatus.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={colorperStatus[entry.status] ?? colorperStatus.unknown}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background:
                                theme === 'dark' ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
                              border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                              borderRadius: '8px',
                              color: theme === 'dark' ? '#f9fafb' : '#111827',
                              fontSize: '14px',
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#f9fafb' : '#111827' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={24}
                            iconType="circle"
                            wrapperStyle={{
                              fontSize: '14px',
                              paddingTop: '10px',
                              color: 'inherit',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No event data" />
                    )}
                  </div>

                  {/* reports by cluster */}
                  <div
                    className="rounded-[14px] p-4"
                    style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                  >
                    <p
                      className="mb-4 font-medium"
                      style={{ color: 'var(--text-mid)', fontSize: 'var(--text-sm)' }}
                    >
                      Reports by Cluster
                    </p>
                    {reportspercluster.length ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={reportspercluster}
                          margin={{ top: 10, right: 0, left: -24, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="rgba(156,163,175,0.15)"
                          />
                          <XAxis
                            dataKey="cluster"
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            dy={8}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{
                              fill:
                                theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            }}
                            contentStyle={{
                              background:
                                theme === 'dark' ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
                              border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                              borderRadius: '8px',
                              color: theme === 'dark' ? '#f9fafb' : '#111827',
                              fontSize: '14px',
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#f9fafb' : '#111827' }}
                          />
                          <Legend
                            iconType="circle"
                            wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                          />
                          <Bar
                            dataKey="reports"
                            name="Reports"
                            fill="#8B1A1A"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={32}
                          />
                          <Bar
                            dataKey="casualties"
                            name="Casualties"
                            fill="#8A7868"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={32}
                          />
                          <Bar
                            dataKey="missing"
                            name="Missing"
                            fill="#E8C97A"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No cluster reports" />
                    )}
                  </div>
                </div>

                {/* recent events mini table */}
                <div
                  className="overflow-hidden rounded-[14px] md:col-span-3"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div
                    className="px-5 py-3"
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--cream2)' }}
                  >
                    <p
                      className="font-medium tracking-[0.8px] uppercase"
                      style={{ color: 'var(--text-muted)', fontSize: 'var(--text-2xs)' }}
                    >
                      Recent Events
                    </p>
                  </div>
                  <table
                    className="w-full"
                    style={{ borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
                  >
                    <tbody>
                      {data?.events && data.events.length > 0
                        ? data.events.slice(0, 4).map((ev) => (
                            <tr
                              key={ev.id}
                              style={{ borderBottom: '1px solid rgba(139,26,26,0.05)' }}
                            >
                              <td
                                className="px-5 py-3 font-medium"
                                style={{ color: 'var(--text-dark)' }}
                              >
                                {ev.name}
                              </td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}></td>
                              <td className="px-5 py-3 text-right">
                                <StatusBadge status={ev.status?.name ?? ''} />
                              </td>
                            </tr>
                          ))
                        : [1, 2, 3].slice(0, 4).map((n) => (
                            <tr key={n} style={{ borderBottom: '1px solid rgba(139,26,26,0.05)' }}>
                              <td className="px-5 py-3">
                                <div className="skeleton h-4 w-40" />
                              </td>
                              <td className="px-5 py-3">
                                <div className="skeleton h-4 w-20" />
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="skeleton ml-auto h-4 w-16" />
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 h-screen overflow-hidden">
            {track.map((src, i) => (
              <div
                key={i}
                className={cn(
                  'absolute inset-0 transition-opacity duration-1000',
                  i === current ? 'opacity-100' : 'opacity-0'
                )}
              >
                <Image src={src} alt="" fill className="object-cover" priority={i === 0} />
              </div>
            ))}
            <div className="bg-brand-900/60 absolute inset-0" />
            <div
              className="absolute right-0 bottom-0 left-0"
              style={{
                height: '380px',
                background: `linear-gradient(
                            to bottom,
                            transparent 0%,
                            transparent 20%,
                            rgba(250,248,245,0.2) 40%,
                            rgba(250,248,245,0.6) 65%,
                            rgba(250,248,245,0.9) 92%,
                            var(--cream) 100%
                          )`,
              }}
            />
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <div
          className="px-6 py-12 text-center"
          style={{
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            background: 'white',
          }}
        >
          <p
            className="mb-7 text-xs font-medium tracking-[1.2px] uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            Developed under the DRRM-H Program for
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {[
              { abbr: 'UP', name: 'UP Manila', variant: 'maroon' },
              { abbr: 'DRRM', name: 'DRRM-H Center', variant: 'gold' },
              { abbr: 'ERT', name: 'Emergency Response Teams', variant: 'maroon' },
              { abbr: 'HEAD', name: 'HEAD IRS Initiative', variant: 'dark' },
            ].map((item) => (
              <div key={item.abbr} className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-13 w-13 items-center justify-center rounded-full font-bold tracking-[0.5px]"
                  style={{
                    width: '52px',
                    height: '52px',
                    fontSize: 'var(--text-xs)',
                    background:
                      item.variant === 'maroon'
                        ? '#F9ECEC'
                        : item.variant === 'gold'
                          ? '#FDF6E3'
                          : 'var(--cream2)',
                    color:
                      item.variant === 'maroon'
                        ? '#8B1A1A'
                        : item.variant === 'gold'
                          ? '#8B6914'
                          : 'var(--text-mid)',
                  }}
                >
                  {item.abbr}
                </div>
                <span
                  className="max-w-20 text-center"
                  style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}
                >
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURE 1: Event Management ── */}
        <section id="features" className="mx-auto max-w-300 px-6 py-24 lg:px-20">
          <Reveal className="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">
            <div>
              <p
                className="mb-3.5 text-xs font-medium tracking-[1.2px] uppercase"
                style={{ color: 'var(--maroon)' }}
              >
                Event Management
              </p>
              <h2
                className="display mb-4 font-normal"
                style={{
                  fontSize: 'var(--text-section)',
                  lineHeight: 1.15,
                  color: 'var(--text-dark)',
                }}
              >
                Keep every drill
                <br />
                <em style={{ color: 'var(--maroon)' }}>moving forward</em>
              </h2>
              <p
                className="mb-10 font-light"
                style={{
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  maxWidth: '480px',
                  fontSize: 'var(--text-lg)',
                }}
              >
                Track drills and incidents from start to resolution — assign roles, monitor status,
                and maintain full visibility across all active events in real time.
              </p>
              <ul className="flex list-none flex-col gap-5">
                <FeatureListItem
                  icon={<IconCalendar />}
                  title="Real-time drill tracking"
                  desc="Monitor event timelines, statuses, and team assignments across all campus clusters simultaneously."
                />
                <FeatureListItem
                  icon={<IconUser />}
                  title="Role-based assignments"
                  desc="Assign Incident Commanders, Safety Officers, and Liaison Officers directly within each event."
                />
                <FeatureListItem
                  icon={<IconActivity />}
                  title="Protocol checklists"
                  desc="Built-in checklists ensure teams follow established DRRM-H protocols at every stage of the drill."
                />
              </ul>
            </div>

            <div
              className="rounded-[20px] p-8"
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 40px rgba(26,18,8,0.07)',
              }}
            >
              <div className="mb-6 flex gap-2">
                {(['ongoing', 'upcoming', 'completed'] as const).map((t) => (
                  <span
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className="cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-200"
                    style={
                      activeTab === t
                        ? {
                            background: 'var(--maroon)',
                            color: 'white',
                            borderColor: 'var(--maroon)',
                          }
                        : {
                            background: 'var(--cream)',
                            color: 'var(--text-muted)',
                            borderColor: 'var(--border)',
                          }
                    }
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </span>
                ))}
              </div>

              <table
                className="w-full"
                style={{ borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
              >
                <thead>
                  <tr>
                    {['Event Name', 'Location', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-2.5 py-2 text-left font-medium tracking-[0.6px] uppercase"
                        style={{
                          fontSize: 'var(--text-2xs)',
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents && filteredEvents.length > 0 ? (
                    filteredEvents.slice(0, 4).map((ev) => (
                      <tr key={ev.id} style={{ borderBottom: '1px solid rgba(139,26,26,0.05)' }}>
                        <td
                          className="px-2.5 py-2.5 font-medium"
                          style={{ color: 'var(--text-dark)' }}
                        >
                          {ev.name.length > 22 ? ev.name.slice(0, 22) + '…' : ev.name}
                        </td>
                        <td className="px-2.5 py-2.5" style={{ color: 'var(--text-muted)' }}></td>
                        <td className="px-2.5 py-2.5">
                          <StatusBadge status={ev.status?.name ?? ''} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2.5 py-6 text-center"
                        style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}
                      >
                        No {activeTab} events
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* DIVIDER */}
        <div
          style={{
            height: '1px',
            background: 'var(--border)',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        />

        {/* ── FEATURE 2: Reports ── */}
        <section className="mx-auto max-w-300 px-6 py-24 lg:px-20">
          <Reveal className="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">
            {/* visual first on this one (reversed) */}
            <div
              className="order-2 rounded-[20px] p-8 lg:order-1"
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 40px rgba(26,18,8,0.07)',
              }}
            >
              <p
                className="mb-3 font-medium tracking-[0.8px] uppercase"
                style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}
              >
                What gets captured in every drill
              </p>

              {/* feature capability pills */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Headcount tracking', icon: <IconHeadcount /> },
                  { label: 'Casualty documentation', icon: <IconCasualty /> },
                  { label: 'Damage reporting', icon: <IconDamage /> },
                  { label: 'GPS location tagging', icon: <IconGPS /> },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 rounded-[10px] p-3.5"
                    style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--maroon-pale)' }}
                    >
                      {item.icon}
                    </div>
                    <p
                      className="truncate leading-tight font-medium text-wrap"
                      style={{ color: 'var(--text-dark)', fontSize: 'var(--text-sm)' }}
                    >
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* personnel roles the system covers */}
              <div
                className="rounded-[10px] p-3.5"
                style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
              >
                <p
                  className="mb-2.5 font-medium tracking-[0.6px] uppercase"
                  style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}
                >
                  Personnel categories tracked
                </p>
                {[
                  'Students',
                  'Faculty Members',
                  'Admin Staff',
                  'Security Personnel',
                  'Health Workers',
                  'Non-Academic Staff',
                  'Guests & Visitors',
                ].map((role) => (
                  <div
                    key={role}
                    className="flex items-center gap-2 py-1.5"
                    style={{
                      color: 'var(--text-mid)',
                      borderBottom: '1px solid rgba(139,26,26,0.05)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'var(--maroon)', opacity: 0.4 }}
                    />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <p
                className="mb-3.5 text-xs font-medium tracking-[1.2px] uppercase"
                style={{ color: 'var(--maroon)' }}
              >
                Incident Reporting
              </p>
              <h2
                className="display mb-4 font-normal"
                style={{
                  fontSize: 'var(--text-section)',
                  lineHeight: 1.15,
                  color: 'var(--text-dark)',
                }}
              >
                Structured reports,
                <br />
                <em style={{ color: 'var(--maroon)' }}>zero paperwork</em>
              </h2>
              <p
                className="mb-10 font-light"
                style={{
                  fontSize: 'var(--text-lg)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  maxWidth: '480px',
                }}
              >
                Field teams submit reports via the mobile app. Data flows directly into the
                dashboard with headcount breakdowns, casualty tracking, and damage documentation.
              </p>
              <ul className="flex list-none flex-col gap-5">
                <FeatureListItem
                  icon={<IconDoc />}
                  title="Automated summaries"
                  desc="The system generates structured summaries from submitted field data — no manual compilation needed."
                />
                <FeatureListItem
                  icon={<IconActivity />}
                  title="Headcount tracking"
                  desc="Capture detailed headcounts by personnel type — faculty, students, security, health workers, and more."
                />
                <FeatureListItem
                  icon={<IconCalendar />}
                  title="Cross-drill comparison"
                  desc="Compare data across drills over time to identify trends, gaps, and areas for improvement."
                />
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ── FEATURE CARDS ── */}
        <div id="about" style={{ background: 'white', padding: '96px clamp(20px, 5vw, 80px)' }}>
          <div className="mx-auto max-w-300">
            <Reveal className="mx-auto mb-12 max-w-140 text-center">
              <p
                className="mb-3.5 text-xs font-medium tracking-[1.2px] uppercase"
                style={{ color: 'var(--maroon)' }}
              >
                Built for simplicity
              </p>
              <h2
                className="display mb-3 font-normal"
                style={{
                  fontSize: 'var(--text-section)',
                  lineHeight: 1.15,
                  color: 'var(--text-dark)',
                }}
              >
                Everything your ERT
                <br />
                <em style={{ color: 'var(--maroon)' }}>team needs</em>
              </h2>
              <p
                className="font-light"
                style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 'var(--text-lg)' }}
              >
                Designed for UP Manila's emergency response workflow — from real-time field
                submission to post-drill evaluation.
              </p>
            </Reveal>

            <Reveal
              delay={100}
              className="grid grid-cols-1 gap-5 md:grid-cols-4 lg:grid-cols-4 lg:justify-items-center"
            >
              <FCard
                icon={<IconLayers />}
                title="Mobile Field Reporting"
                desc="Field teams use the companion Flutter mobile app to submit incident data in real time — no pen and paper required."
              />
              <FCard
                icon={<IconClock />}
                title="Real-time Updates"
                desc="Data flows instantly from the mobile app into the web dashboard. Administrators see submissions as they happen."
              />
              <FCard
                icon={<IconChart />}
                title="Performance Analytics"
                desc="Compare drill results over time, track ERT compliance, and generate insights to improve protocol adherence."
              />
              <FCard
                icon={<IconUsers />}
                title="Role-Based Access"
                desc="Admins, Encoders, and Viewers have appropriate access. Field roles — Security, Medical, Fire Marshal — see only their data."
              />
              <FCard
                icon={<IconShield />}
                title="Activity Audit Trail"
                desc="Every action — report submission, user update, event creation — is logged with timestamps for full accountability."
              />
              <FCard
                icon={<IconSearch />}
                title="Cross-drill Search"
                desc="Search and filter across all drills, reports, and clusters to find the data you need for evaluation and planning."
              />
              <FCard
                icon={<IconOffline />}
                title="Offline Functionality"
                desc="Reports can be submitted even without internet connection. Data is queued locally and automatically synced once connectivity is restored."
              />
              <FCard
                icon={<School color={'white'} size={20} />}
                title="Campus-Wide Overview"
                desc="Accumulated data on headcount and structure conditions are presented in charts for easy inspection."
              />
            </Reveal>
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="mx-auto max-w-300 px-6 py-24 lg:px-20">
          <Reveal className="mx-auto mb-16 max-w-130 text-center">
            <p
              className="mb-3.5 text-xs font-medium tracking-[1.2px] uppercase"
              style={{ color: 'var(--maroon)' }}
            >
              How It Works
            </p>
            <h2
              className="display font-normal"
              style={{
                fontSize: 'var(--text-section)',
                lineHeight: 1.15,
                color: 'var(--text-dark)',
              }}
            >
              From drill to
              <br />
              <em style={{ color: 'var(--maroon)' }}>detailed summary</em>
            </h2>
          </Reveal>

          <Reveal delay={100} className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: '01',
                title: 'Admin creates an event',
                desc: 'Set up a drill or incident event, assign the Incident Commander, and activate cluster-level reporting assignments.',
              },
              {
                num: '02',
                title: 'Field teams submit reports',
                desc: 'ERT members use the mobile app to document headcounts, casualties, damage, and observations in real time.',
              },
              {
                num: '03',
                title: 'Data aggregates instantly',
                desc: 'The dashboard collects all submissions automatically, organized by cluster, role, and incident type for immediate review.',
              },
              {
                num: '04',
                title: 'Summaries drive improvement',
                desc: 'Post-drill summaries and cross-event comparisons give administrators insights to strengthen ERT skills and refine protocols.',
              },
            ].map((step) => (
              <div key={step.num}>
                <p
                  className="display mb-3"
                  style={{ fontSize: '48px', color: '#F2D9D9', lineHeight: 1 }}
                >
                  {step.num}
                </p>
                <h3
                  className="mb-2 font-medium"
                  style={{ color: 'var(--text-dark)', fontSize: 'var(--text-lg)' }}
                >
                  {step.title}
                </h3>
                <p
                  className="leading-relaxed font-light"
                  style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ── ABOUT / QUOTE SECTION ── */}
        <div
          className="relative overflow-hidden text-center"
          style={{ background: 'var(--maroon)' }}
        >
          {/* big decorative quote mark */}
          <div
            className="display pointer-events-none absolute select-none"
            style={{
              top: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '320px',
              color: 'rgba(255,255,255,0.04)',
              lineHeight: 1,
            }}
          >
            "
          </div>

          <div className="relative mx-auto max-w-225 px-6 py-24">
            {/* eyebrow */}
            <p
              className="mb-6 font-medium tracking-[1.4px] uppercase"
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: 'var(--text-2xs)' }}
            >
              From the Head of Unit
            </p>

            {/* real verified quote */}
            <blockquote
              className="display mx-auto mb-8 font-normal italic"
              style={{
                fontSize: 'var(--text-quote)',
                color: 'white',
                maxWidth: '780px',
                lineHeight: 1.55,
              }}
            >
              "The Philippines is one of the most disaster-prone countries in the world. Through UPM
              DRRM-H, we seek to conduct training and seminars that will prepare our responders,
              even ordinary employees, in disaster preparedness through our state-of-the-art
              facilities."
            </blockquote>

            {/* attribution */}
            <div>
              <div className="mb-2 flex items-center justify-center">
                <div
                  className="rounded-full p-1.5"
                  style={{
                    border: '2.5px solid var(--gold-light)',
                  }}
                >
                  <Image
                    src="/carlos-gundran-profile-image.png"
                    alt="Profile Picture"
                    width={128}
                    height={128}
                    sizes="128px"
                    className="rounded-full object-cover"
                  />
                </div>
              </div>
              <p
                className="font-light"
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-base)' }}
              >
                <strong className="mb-0.5 block font-medium" style={{ color: 'white' }}>
                  Dr. Carlos Primero D. Gundran
                </strong>
                Head, UPM DRRM-H — at its launch on June 8, 2022
              </p>
            </div>

            {/* divider */}
            <div
              className="mx-auto mt-10 mb-10 h-px w-24"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />

            {/* founding stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  value: 'June 8, 2022',
                  label: 'Officially launched',
                  sub: 'Joaquin Gonzales Hall, UP Manila',
                },
                {
                  value: 'DRRM Act 2010',
                  label: 'Aligned with',
                  sub: 'Republic Act 10121 thematic pillars',
                },
              ].map((card) => (
                <div
                  key={card.value}
                  className="rounded-[14px] px-6 py-5 text-left"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <p
                    className="display mb-1 font-normal"
                    style={{ color: 'white', lineHeight: 1.2, fontSize: 'var(--text-xl)' }}
                  >
                    {card.value}
                  </p>
                  <p
                    className="mb-0.5 text-xs font-medium"
                    style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}
                  >
                    {card.label}
                  </p>
                  <p
                    className="font-light"
                    style={{ color: 'rgba(255,255,255,0.35)', fontSize: 'var(--text-xs)' }}
                  >
                    {card.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── VISION & MISSION ── */}
        <div style={{ background: 'var(--white)', padding: '96px clamp(20px, 6vw, 80px)' }}>
          <div className="mx-auto max-w-200">
            <Reveal className="mb-12 text-center">
              <p
                className="section-eyebrow mb-3.5 text-xs font-medium tracking-[1.2px] uppercase"
                style={{ color: 'var(--maroon)' }}
              >
                Who We Are
              </p>
              <h2
                className="display font-normal"
                style={{
                  fontSize: 'var(--text-section)',
                  lineHeight: 1.15,
                  color: 'var(--text-dark)',
                }}
              >
                Our Vision & <em style={{ color: 'var(--maroon)' }}>Mission</em>
              </h2>
            </Reveal>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
              {/* Vision */}
              <Reveal>
                <div
                  className="max- h-full rounded-[20px] p-8"
                  style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'var(--maroon)' }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.8"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                      </svg>
                    </div>
                    <h3
                      className="font-medium"
                      style={{ color: 'var(--text-dark)', fontSize: 'var(--text-lg)' }}
                    >
                      Vision
                    </h3>
                  </div>
                  <p
                    className="leading-relaxed font-light"
                    style={{
                      color: 'var(--text-mid)',
                      lineHeight: 1.75,
                      fontSize: 'var(--text-md)',
                    }}
                  >
                    The academe's center for world-class capacity building, research, and public
                    services in DRRM-H-related issues in the Philippines by 2030.
                  </p>
                </div>
              </Reveal>

              {/* Mission */}
              <Reveal delay={100}>
                <div
                  className="h-full rounded-[20px] p-8"
                  style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'var(--maroon)' }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.8"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <h3
                      className="font-medium"
                      style={{ color: 'var(--text-dark)', fontSize: 'var(--text-lg)' }}
                    >
                      Mission
                    </h3>
                  </div>
                  <ul className="flex flex-col items-center justify-center gap-3">
                    {[
                      'UPlift the value and status of the organization as the lead resource in disaster risk reduction and management in health.',
                      "Develop individuals' competence in DRRM-H to minimize disaster-related injuries, disabilities, diseases, and deaths through capacity-building, research, and public service.",
                      'Revitalize institutional linkages with multiple stakeholders, enabling enhanced collaboration among healthcare providers, community leaders, and the academe.',
                      'Reinforce research agendas to gather evidence-based data, create policies, programs, and publications toward a health-resilient community.',
                      'Motivate internal stakeholders toward professional and personal upliftment while managing resources to achieve sustainability.',
                      'Harness technological advancements to create world-class processes promoting innovative programs and quality of life.',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center justify-center gap-3">
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: 'var(--maroon)', opacity: 0.5 }}
                        />
                        <span
                          className="leading-relaxed font-light"
                          style={{ color: 'var(--text-mid)', fontSize: 'var(--text-base)' }}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div
          id="contact"
          className="relative overflow-hidden px-6 text-center"
          style={{ padding: '96px clamp(20px, 6vw, 80px)', background: 'var(--cream2)' }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              bottom: '-80px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,26,26,0.07) 0%, transparent 70%)',
            }}
          />
          <h2
            className="display mb-4 font-normal"
            style={{
              fontSize: 'var(--text-cta)',
              lineHeight: 1.15,
              color: 'var(--text-dark)',
            }}
          >
            Ready to strengthen your
            <br />
            <em style={{ color: 'var(--maroon)' }}>emergency response?</em>
          </h2>
          <p
            className="mx-auto mb-9 font-light"
            style={{
              color: 'var(--text-muted)',
              maxWidth: '440px',
              lineHeight: 1.65,
              fontSize: 'var(--text-lg)',
            }}
          >
            Access the IRS dashboard or reach out to the DRRM-H Center to get your team onboarded.
          </p>
          <div className="mb-16 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/signin"
              target="_blank"
              className="rounded-[10px] px-7 py-3.5 font-medium text-white no-underline transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'var(--maroon)',
                boxShadow: '0 4px 20px rgba(139,26,26,0.28)',
                fontSize: 'var(--text-md)',
              }}
            >
              Access the System
            </Link>
            <Link
              href="/bystander-report"
              className="rounded-[10px] flex items-center justify-center gap-2 border px-6 py-3.5 no-underline transition-all duration-200 hover:-translate-y-0.5"
              style={{
                color: 'var(--maroon)',
                borderColor: 'var(--border)',
                background: 'rgba(255,255,255,0.6)',
                fontSize: 'var(--text-md)',
              }}
            >
              Submit a Bystander Report
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* live CTA stat strip */}
          <div
            className="mx-auto max-w-225 overflow-hidden rounded-[18px]"
            style={{
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(26,18,8,0.1)',
              background: 'white',
            }}
          >
            <div
              className="flex items-center gap-2 px-4"
              style={{
                height: '44px',
                background: 'var(--cream2)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="grid grid-cols-2 gap-4 p-7 md:grid-cols-4">
              {[
                {
                  label: 'Total Events',
                  value: data?.totalEvents?.toLocaleString(),
                  sub: 'From 2025-2026',
                },
                {
                  label: 'Clusters Covered',
                  value: '4',
                  sub: 'Across UP Manila campuses',
                },
                {
                  label: 'Established',
                  value: '2022',
                  sub: 'UP Manila DRRM-H launch',
                },
                {
                  label: 'Active Events',
                  value: data?.activeEvents?.toLocaleString(),
                  sub: 'Currently running',
                  accent: true,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-4"
                  style={{
                    background: item.accent ? 'var(--maroon)' : 'var(--cream)',
                    border: item.accent ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <p
                    className="mb-2 tracking-[0.7px] uppercase"
                    style={{
                      color: item.accent ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                      fontSize: 'var(--text-2xs)',
                    }}
                  >
                    {item.label}
                  </p>
                  {item.value !== undefined ? (
                    <p
                      className="display leading-none"
                      style={{
                        color: item.accent ? 'white' : 'var(--text-dark)',
                        fontSize: 'var(--text-2xl)',
                      }}
                    >
                      {item.value}
                    </p>
                  ) : (
                    <div
                      className="skeleton h-7 w-12"
                      style={{ background: item.accent ? 'rgba(255,255,255,0.2)' : undefined }}
                    />
                  )}
                  <p
                    className="mt-1 text-xs"
                    style={{ color: item.accent ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)' }}
                  >
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer
          style={{
            background: '#1A1208',
            paddingTop: '90px',
            paddingLeft: 'clamp(20px, 6vw, 80px)',
            paddingRight: 'clamp(20px, 6vw, 80px)',
            paddingBottom: '0px',
          }}
        >
          <div
            className="mx-auto grid max-w-325 grid-cols-1 gap-12 pb-28 lg:grid-cols-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <Image
                  src="/up-logo.png"
                  alt="UP Manila Logo"
                  width={42}
                  height={42}
                  sizes="42px"
                  className="object-contain"
                />
                <Image
                  src="/upm-drrmh-logo.png"
                  alt="DRRM-H Logo"
                  width={42}
                  height={42}
                  sizes="42px"
                  className="object-contain"
                />
                <Image
                  src="/irs-logo.png"
                  alt="IRS Logo"
                  width={42}
                  height={42}
                  sizes="42px"
                  className="object-contain"
                />
                <span className="font-medium text-white" style={{ fontSize: 'var(--text-base)' }}>
                  UPM DRRM-H — IRS
                </span>
              </div>
              <p
                className="max-w-75 leading-relaxed font-light"
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-sm)' }}
              >
                The Incident Reporting System automates emergency drill documentation for the UP
                Manila DRRM-H Center, improving ERT skills and protocol compliance through
                data-driven evaluation.
              </p>
            </div>
            <div>
              <h4
                className="mb-4 text-xs font-medium tracking-[1px] uppercase"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Contact
              </h4>
              <ul className="flex list-none flex-col gap-2.5">
                {[
                  { label: 'drrmh.upm@up.edu.ph', href: 'mailto:drrmh.upm@up.edu.ph' },
                  {
                    label: 'DRRM-H Facebook',
                    href: 'https://www.facebook.com/UPSimulationCenter',
                  },
                  { label: 'DRRM-H Hotline 811-41-279', href: 'tel:81141279' },
                  { label: 'Padre Faura St., Ermita, Manila', href: '#' },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="font-light no-underline"
                      style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4
                className="mb-4 text-xs font-medium tracking-[1px] uppercase"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Emergency Contact
              </h4>
              <ul className="grid list-none grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { label: 'National Hotline', href: 'tel:911', display: '911' },
                  {
                    label: 'UPM Police',
                    href: 'tel:0285548400',
                    display: '(02) 8554-8400',
                  },
                  {
                    label: 'UP PGH',
                    href: 'tel:0285548400',
                    display: '(02) 8554-8400',
                  },
                  { label: 'PAGASA', href: 'tel:0280271541', display: '(02) 8027-1541' },
                  { label: 'NDDRMC', href: 'tel:0289115061', display: '(02) 8911-5061' },
                  { label: 'Manila DRRMO', href: 'tel:0284633295', display: '(02) 8463-3295' },
                  {
                    label: 'Philippine Coast Guard',
                    href: 'tel:0285273877',
                    display: '(02) 8527-3877',
                  },
                  {
                    label: 'Bureau of Fire Protection',
                    href: 'tel:024260219',
                    display: '(02) 426-0219',
                  },
                  { label: 'Red Cross', href: 'tel:143', display: '143' },
                ].map((item) => (
                  <li key={item.label}>
                    <p
                      className="font-light"
                      style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}
                    >
                      {item.label}
                    </p>
                    <a
                      href={item.href}
                      className="ml-2 text-xs font-medium no-underline"
                      style={{ color: 'rgba(255,255,255,0.65)' }}
                    >
                      {item.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div
            className="relative mx-auto mt-6 flex max-w-300 flex-wrap items-center justify-between gap-3 overflow-hidden text-xs"
            style={{ color: 'rgba(255,255,255,0.28)', paddingBottom: 'clamp(80px, 28vw, 200px)' }}
          >
            <span>© 2026 UP Manila DRRM-H — Incident Reporting System. All rights reserved.</span>
            <span>Developed under the DRRM-H Program · Dr. Carlos Primero D. Gundran</span>
            {/* oversized IRS watermark */}
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 overflow-hidden leading-none select-none">
              <p
                className="display text-center font-bold"
                style={{
                  fontSize: 'clamp(220px, 20vw, 320px)',
                  color: 'rgba(255,255,255,0.15)',
                  lineHeight: 0.92,
                  marginBottom: '-0.30em',
                }}
              >
                IRS
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Small reusable pieces
───────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ongoing: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    completed: 'bg-brand-50 text-brand-700 border-brand-100',
    upcoming: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <span
      style={{ fontSize: 'var(--text-xs)' }}
      className={`inline-block rounded-full border px-2.5 py-0.5 font-medium ${map[status] ?? 'border-gray-200 bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number | undefined;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[rgba(139,26,26,0.1)] bg-[#F3EFE8] p-5">
      <p
        className="mb-2 font-medium tracking-[0.8px] text-[#8A7868] uppercase"
        style={{ fontSize: 'var(--text-2xs)' }}
      >
        {label}
      </p>
      {value === undefined ? (
        <div className="h-9 w-20 animate-pulse rounded-md bg-[#E8E2D8]" />
      ) : (
        <p
          className="font-['Instrument_Serif'] leading-none"
          style={{ color: accent ? '#8B1A1A' : '#1A1208', fontSize: 'var(--text-3xl)' }}
        >
          {value}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-[#8A7868]">{sub}</p>}
    </div>
  );
}

function ProgressRow({
  name,
  pct,
  reports,
  color = 'maroon',
}: {
  name: string;
  pct: number;
  reports: number;
  color?: 'maroon' | 'gold';
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 300);
    return () => clearTimeout(t);
  }, [pct]);

  const barColor = color === 'gold' ? '#C9A84C' : '#8B1A1A';

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-25 text-xs text-[#8A7868]">{name}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8E2D8]">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="min-w-13 text-right text-xs font-medium text-[#4A3728]">
        {reports} {reports === 1 ? 'drill' : 'drills'}
      </span>
    </div>
  );
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#F9ECEC]">
      {children}
    </div>
  );
}

function FeatureListItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <FeatureIcon>{icon}</FeatureIcon>
      <div>
        <p className="mb-1 font-medium text-[#1A1208]" style={{ fontSize: 'var(--text-md)' }}>
          {title}
        </p>
        <p
          className="leading-relaxed font-light text-[#8A7868]"
          style={{ fontSize: 'var(--text-base)' }}
        >
          {desc}
        </p>
      </div>
    </li>
  );
}

function FCard({
  icon,
  title,
  desc,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} rounded-[18px] border border-[rgba(139,26,26,0.1)] bg-[#FAF8F5] p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg`}
    >
      <div className="mb-5 flex h-11.5 w-11.5 items-center justify-center rounded-xl bg-[#8B1A1A]">
        {icon}
      </div>
      <h3 className="mb-2 font-medium text-[#1A1208]" style={{ fontSize: 'var(--text-lg)' }}>
        {title}
      </h3>
      <p
        className="leading-relaxed font-light text-[#8A7868]"
        style={{ fontSize: 'var(--text-base)' }}
      >
        {desc}
      </p>
    </div>
  );
}

/* Scroll reveal hook */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* SVG Icons */
const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B1A1A" strokeWidth="1.8">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B1A1A" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const IconActivity = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B1A1A" strokeWidth="1.8">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B1A1A" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconLayers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);
const IconClock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconSearch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconHeadcount = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--maroon)"
    strokeWidth="1.8"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconCasualty = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--maroon)"
    strokeWidth="1.8"
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
const IconDamage = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--maroon)"
    strokeWidth="1.8"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
    <path d="M12 7l-2 4h4l-2 4" />
  </svg>
);
const IconGPS = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--maroon)"
    strokeWidth="1.8"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconOffline = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <path d="M1 6l4 4a9 9 0 0 1 14 0l4-4A15 15 0 0 0 1 6z" />
    <path d="M5 12.5l4 4a5 5 0 0 1 6 0l4-4a11 11 0 0 0-14 0z" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);
