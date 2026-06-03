"use client";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Code editor
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="mt-2 min-h-[30rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-teal-400"
        placeholder="def solve(...):&#10;    return ..."
      />
    </label>
  );
}
