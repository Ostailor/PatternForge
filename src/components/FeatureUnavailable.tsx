import Link from "next/link";

type FeatureUnavailableProps = {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
};

export default function FeatureUnavailable({
  eyebrow = "Unavailable",
  title,
  description,
  href = "/",
  actionLabel = "Back to dashboard",
}: FeatureUnavailableProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          {description}
        </p>
        <Link
          href={href}
          className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          {actionLabel}
        </Link>
      </section>
    </div>
  );
}
