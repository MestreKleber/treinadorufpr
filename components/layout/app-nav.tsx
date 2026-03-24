import Link from "next/link";
import { BookOpen, CalendarClock, ClipboardList, Home, Shield } from "lucide-react";

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/simulado", label: "Simulado", icon: ClipboardList },
  { href: "/resultado", label: "Resultado", icon: BookOpen },
  { href: "/cronograma", label: "Cronograma", icon: CalendarClock },
  { href: "/admin", label: "Admin", icon: Shield },
];

export function AppNav() {
  return (
    <header className="border-b border-amber-200/60 bg-amber-50/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold tracking-wide text-amber-900">UFPR ADS Estudos</p>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900 transition hover:bg-amber-100"
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
