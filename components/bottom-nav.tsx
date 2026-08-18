"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Library, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/library", icon: Library, label: "Library" },
  { href: "/", icon: Compass, label: "Discover" },
  { href: "/profile", icon: UserCircle, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  // The full player is an immersive screen; the tab bar would fight it.
  if (pathname?.startsWith("/reader/") || pathname?.startsWith("/auth")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl pb-safe">
      <div className="mx-auto flex h-16 max-w-2xl items-stretch justify-around">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/15")} />
              <span className={cn(active && "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
