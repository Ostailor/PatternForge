import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/patterns", label: "Patterns" },
  { href: "/forge", label: "Daily Forge" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white shadow-sm">
            PF
          </span>
          <span className="text-base font-black tracking-tight text-slate-950">
            PatternForge
          </span>
        </Link>
        <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex sm:w-auto sm:items-center">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-2 text-center text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 sm:px-3 sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
