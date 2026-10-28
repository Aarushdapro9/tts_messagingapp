import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { customThemeOptions, createThemeSettings, normalizeThemeConfig, resolveTheme, themeCatalog, themeCategories } from '../utils/theme';

const editorColors = [
  ['app', 'App background'], ['surface', 'Chat background'], ['sidebar', 'Sidebar'], ['header', 'Header'], ['input', 'Input'],
  ['accent', 'Accent'], ['outgoing', 'Your bubbles'], ['incoming', 'Other bubbles'], ['outgoingText', 'Your text'], ['incomingText', 'Reply text'],
];

const thumbnailStyle = (config) => ({
  backgroundColor: config.surface,
  backgroundImage: config.gradient === 'none' ? 'none' : `linear-gradient(135deg, ${config.accent}, ${config.outgoing})`,
});

function ThemePreview({ config }) {
  return <div className="overflow-hidden rounded-xl border border-black/10 shadow-sm" style={{ background: config.app, color: config.text, fontFamily: config.font === 'serif' ? 'Georgia, serif' : config.font === 'mono' ? 'ui-monospace, monospace' : 'system-ui' }}>
    <div className="flex items-center justify-between px-3 py-2 text-xs font-bold" style={{ background: config.header, color: config.text }}><span>Theme preview</span><span style={{ color: config.accent }}>●</span></div>
    <div className="min-h-[118px] space-y-2 p-3" style={{ background: config.surface, backgroundImage: config.gradient === 'none' ? 'none' : `linear-gradient(135deg, ${config.surface}e8, ${config.accent}1f)` }}>
      <div className="w-fit max-w-[85%] rounded-bl-md rounded-br-xl rounded-tr-xl px-3 py-2 text-xs" style={{ background: config.incoming, color: config.incomingText, borderRadius: `${config.radius}px` }}>Looks great!<small className="ml-2 opacity-60">10:32</small></div>
      <div className="ml-auto w-fit max-w-[85%] rounded-bl-xl rounded-tl-xl rounded-tr-md px-3 py-2 text-xs" style={{ background: config.outgoing, color: config.outgoingText, borderRadius: `${config.radius}px` }}>Applied instantly <small className="ml-2 opacity-60">✓✓</small></div>
    </div>
    <div className="flex gap-2 p-2" style={{ background: config.input }}><span className="flex-1 rounded-full px-3 py-1 text-[10px]" style={{ background: config.surface, color: config.muted }}>Message</span><span className="rounded-full px-2 py-1 text-[10px]" style={{ background: config.send, color: config.outgoingText }}>Send</span></div>
  </div>;
}

function ThemeTile({ theme, selected, favorite, onApply, onFavorite }) {
  const { config } = theme;
  return <article className={`relative overflow-hidden rounded-xl border bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 ${selected ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/30' : 'border-slate-200'}`}>
    <button type="button" onClick={() => onApply(theme.id)} className="block w-full text-left" aria-label={`Apply ${theme.name}`}>
      <div className="h-16 rounded-lg p-2" style={thumbnailStyle(config)}>
        <div className="h-3 w-3/5 rounded-full opacity-80" style={{ background: config.header }} />
        <div className="ml-auto mt-3 h-4 w-1/2 rounded-bl-md rounded-tl-md" style={{ background: config.outgoing }} />
        <div className="mt-1 h-3 w-2/5 rounded-br-md rounded-tr-md" style={{ background: config.incoming }} />
      </div>
      <p className="mt-2 truncate text-[11px] font-bold text-slate-800">{theme.name}</p>
      <p className="truncate text-[9px] text-slate-500">{theme.source === 'custom' ? 'Your custom theme' : `${theme.family} · Custom-inspired`}</p>
    </button>
    <button type="button" onClick={() => onFavorite(theme.id)} className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-xs" aria-label={`${favorite ? 'Remove' : 'Add'} ${theme.name} ${favorite ? 'from' : 'to'} favorites`}>{favorite ? '★' : '☆'}</button>
  </article>;
}

function ThemeStudio({ settings, legacyTheme, onSave, saving }) {
  const normalizedSettings = useMemo(() => {
    const next = createThemeSettings(settings);
    const legacy = resolveTheme(null, legacyTheme);
    if (!settings && legacy.source === 'legacy') {
      return { ...next, selectedThemeId: 'legacy-theme', customThemes: [{ id: 'legacy-theme', name: 'Previous theme', config: legacy.config }] };
    }
    return next;
  }, [settings, legacyTheme]);
  const resolved = useMemo(() => resolveTheme(normalizedSettings, legacyTheme), [normalizedSettings, legacyTheme]);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [draft, setDraft] = useState(() => normalizeThemeConfig(resolved.config));
  const [customName, setCustomName] = useState('My custom theme');

  useEffect(() => setDraft(normalizeThemeConfig(resolved.config)), [resolved.config]);

  const allThemes = useMemo(() => [...themeCatalog, ...normalizedSettings.customThemes.map((theme) => ({ ...theme, family: 'Custom', source: 'custom' }))], [normalizedSettings.customThemes]);
  const visibleThemes = useMemo(() => allThemes.filter((theme) => {
    const matchesCategory = category === 'All' || (category === 'Custom' ? theme.family === 'Custom' : theme.family === category || theme.tags?.includes(category));
    const matchesQuery = !deferredQuery || `${theme.name} ${theme.family} ${theme.tags?.join(' ')}`.toLowerCase().includes(deferredQuery);
    return matchesCategory && matchesQuery;
  }), [allThemes, category, deferredQuery]);

  const persist = async (next) => { await onSave(next); };
  const applyTheme = async (id) => persist({ ...normalizedSettings, selectedThemeId: id });
  const toggleFavorite = async (id) => {
    const favorites = normalizedSettings.favorites.includes(id) ? normalizedSettings.favorites.filter((favorite) => favorite !== id) : [...normalizedSettings.favorites, id];
    await persist({ ...normalizedSettings, favorites });
  };
  const saveCustomTheme = async () => {
    const id = `custom-${Date.now().toString(36)}`;
    const customTheme = { id, name: customName.trim().slice(0, 40) || 'My custom theme', config: normalizeThemeConfig(draft) };
    await persist({ ...normalizedSettings, selectedThemeId: id, customThemes: [...normalizedSettings.customThemes, customTheme].slice(-20) });
  };
  const removeCustomTheme = async (id) => {
    const customThemes = normalizedSettings.customThemes.filter((theme) => theme.id !== id);
    await persist({ ...normalizedSettings, customThemes, favorites: normalizedSettings.favorites.filter((favorite) => favorite !== id), selectedThemeId: normalizedSettings.selectedThemeId === id ? 'whatsapp-classic-light' : normalizedSettings.selectedThemeId });
  };

  return <section className="mt-5 bg-white px-4 py-5 shadow-md" aria-label="Theme studio">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Theme studio</h2><p className="mt-1 max-w-md text-xs text-slate-600">Choose a library theme or create one of your own. Changes apply immediately and sync to your account.</p></div>
      <button type="button" onClick={() => applyTheme('whatsapp-classic-light')} disabled={saving} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Reset to default</button>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <label className="sr-only" htmlFor="theme-search">Search themes</label><input id="theme-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search themes" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--theme-accent)]" />
        <div className="mt-3 flex flex-wrap gap-2">{themeCategories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1 text-xs font-bold ${category === item ? 'bg-[var(--theme-accent)] text-white' : 'border border-slate-300 text-slate-700'}`}>{item}</button>)}</div>
        <p className="mt-3 text-[11px] text-slate-500">{visibleThemes.length} ready-to-use themes · all library visuals are custom-inspired, not official brand artwork.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleThemes.map((theme) => <ThemeTile key={theme.id} theme={theme} selected={resolved.id === theme.id} favorite={normalizedSettings.favorites.includes(theme.id)} onApply={applyTheme} onFavorite={toggleFavorite} />)}</div>
      </div>
      <div><p className="mb-2 text-xs font-bold text-slate-700">Live preview</p><ThemePreview config={draft} /><p className="mt-2 text-[10px] text-slate-500">Current: {resolved.name}</p></div>
    </div>

    <details className="mt-6 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-bold text-slate-800">Create a custom theme</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-slate-700">Theme name<input value={customName} maxLength="40" onChange={(event) => setCustomName(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
          <div className="mt-3 grid grid-cols-2 gap-2">{editorColors.map(([key, label]) => <label key={key} className="rounded border border-slate-200 p-2 text-[10px] font-bold text-slate-600">{label}<span className="mt-1 flex items-center gap-2"><input type="color" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" /><output className="font-mono text-[9px]">{draft[key]}</output></span></label>)}</div>
        </div>
        <div className="space-y-3 text-xs text-slate-700">
          <label className="block font-bold">Bubble style<select value={draft.radius} onChange={(event) => setDraft((current) => ({ ...current, radius: Number(event.target.value) }))} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal"><option value="6">Squared</option><option value="16">Rounded</option><option value="24">Soft rounded</option><option value="32">Pill</option></select></label>
          <label className="block font-bold">Background pattern<select value={draft.pattern} onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">{customThemeOptions.patterns.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="block font-bold">Accent gradient<select value={draft.gradient} onChange={(event) => setDraft((current) => ({ ...current, gradient: event.target.value }))} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">{customThemeOptions.gradients.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="block font-bold">Font<select value={draft.font} onChange={(event) => setDraft((current) => ({ ...current, font: event.target.value }))} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">{customThemeOptions.fonts.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          {[['brightness', 'Background brightness', 55, 130], ['transparency', 'Chat transparency', 45, 100]].map(([key, label, min, max]) => <label key={key} className="block font-bold">{label}: {draft[key]}%<input type="range" min={min} max={max} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: Number(event.target.value) }))} className="mt-1 block w-full accent-[var(--theme-accent)]" /></label>)}
          <button type="button" onClick={saveCustomTheme} disabled={saving} className="w-full rounded-md bg-[var(--theme-accent)] px-3 py-2 font-bold text-white disabled:opacity-50">Save and apply custom theme</button>
        </div>
      </div>
    </details>

    {normalizedSettings.customThemes.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold text-slate-800">Manage custom themes</h3><div className="mt-2 flex flex-wrap gap-2">{normalizedSettings.customThemes.map((theme) => <span key={theme.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs"><span>{theme.name}</span><button type="button" onClick={() => removeCustomTheme(theme.id)} className="font-bold text-red-600" aria-label={`Delete ${theme.name}`}>×</button></span>)}</div></div>}
  </section>;
}

export default ThemeStudio;
