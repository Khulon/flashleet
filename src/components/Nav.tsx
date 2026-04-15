"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { Home, BarChart2, Star, Settings } from "lucide-react";

const links = [
  { href: "/learn",    icon: Home,      label: "Learn"    },
  { href: "/stats",    icon: BarChart2, label: "Stats"    },
  { href: "/search",   icon: Star,      label: "Search"   },
  { href: "/settings", icon: Settings,  label: "Settings" },
] as const;

type Href = typeof links[number]["href"];

function hrefFromPath(p: string): Href {
  if (p.startsWith("/search"))   return "/search";
  if (p.startsWith("/stats"))    return "/stats";
  if (p.startsWith("/settings")) return "/settings";
  return "/learn";
}

// Each button is 56px wide with 4px gap → 60px per step
const BUTTON_W = 56;
const GAP      = 4;
const NAV_PAD  = 6;

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Optimistic active state — updates instantly on tap, then syncs with real pathname
  const [active, setActive] = useState<Href>(() => hrefFromPath(pathname));

  // Sync when navigation actually completes (handles browser back/forward too)
  useEffect(() => {
    setActive(hrefFromPath(pathname));
  }, [pathname]);

  // Prefetch all routes on mount so navigation is fast
  useEffect(() => {
    links.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  const handleTap = (href: Href) => {
    // flushSync forces React to commit this render synchronously before router.push
    // fires. Without it, React 18 batches setActive with router.push's startTransition
    // and defers the render (and animation) until the page finishes loading.
    flushSync(() => setActive(href));
    router.push(href);
  };

  const activeIndex = links.findIndex(l => l.href === active);

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
      display: "flex", justifyContent: "center",
      paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      pointerEvents: "none",
    }}>
      <nav style={{
        pointerEvents: "auto",
        position: "relative",
        display: "flex", alignItems: "center",
        background: "var(--bg-card)",
        border: "2px solid var(--border)",
        borderRadius: 999,
        padding: NAV_PAD,
        boxShadow: "0 8px 32px rgba(108,99,255,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        gap: GAP,
      }}>
        {/*
          CSS transition on transform — runs on the GPU compositor thread,
          completely unaffected by JS main thread work (e.g. stats page rendering
          hundreds of DOM nodes which blocks rAF / Framer Motion).
        */}
        <div
          style={{
            position: "absolute",
            top: NAV_PAD, left: NAV_PAD,
            width: BUTTON_W, height: 48,
            borderRadius: 999,
            background: "var(--purple-lt)",
            pointerEvents: "none",
            willChange: "transform",
            transform: `translateX(${activeIndex * (BUTTON_W + GAP)}px)`,
            transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />

        {links.map(({ href, icon: Icon, label }) => {
          const isActive = active === href;
          return (
            <motion.button
              key={href}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleTap(href)}
              aria-label={label}
              style={{
                position: "relative", zIndex: 1,
                width: BUTTON_W, height: 48,
                borderRadius: 16, border: "none",
                cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 3, padding: 0,
                background: "transparent",
                color: isActive ? "var(--purple)" : "var(--text-muted)",
                flexShrink: 0,
                transition: "color 0.15s",
                userSelect: "none", WebkitUserSelect: "none",
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span style={{
                fontSize: 9, fontWeight: isActive ? 800 : 600,
                fontFamily: "var(--font-sans)", lineHeight: 1,
                width: 48, textAlign: "center",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}
