"use client";

export default function LanguageSelector() {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Language
      </span>
      <select
        value="Python"
        disabled
        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700"
      >
        <option>Python</option>
      </select>
    </label>
  );
}
