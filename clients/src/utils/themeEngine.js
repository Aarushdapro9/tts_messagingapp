import { defaultThemeId, themeCatalog } from './themeCatalog';

const hexColor = /^#[0-9a-f]{6}$/i;
const colorKeys = ['app', 'surface', 'sidebar', 'accent', 'outgoing', 'incoming', 'text', 'muted', 'outgoingText', 'incomingText', 'header', 'input', 'send', 'timestamp'];
const allowedPatterns = new Set(['none', 'doodle', 'dots', 'leaves', 'waves', 'clouds', 'grid', 'stars', 'hearts', 'sun', 'snow', 'confetti']);
const allowedGradients = new Set(['none', 'instagram', 'violet-pink', 'sunset', 'midnight', 'galaxy', 'aurora', 'cyber']);
const allowedFonts = new Set(['system', 'serif', 'rounded', 'mono']);

const defaultConfig = themeCatalog.find((theme) => theme.id === defaultThemeId).config;

const cloneConfig = (config) => ({ ...config });

export function createThemeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 2,
    selectedThemeId: typeof source.selectedThemeId === 'string' ? source.selectedThemeId : defaultThemeId,
    favorites: Array.isArray(source.favorites) ? source.favorites.filter((id) => typeof id === 'string').slice(0, 50) : [],
    customThemes: Array.isArray(source.customThemes)
      ? source.customThemes.filter((theme) => theme && typeof theme.id === 'string' && typeof theme.name === 'string' && theme.config).slice(0, 20).map((theme) => ({ ...theme, config: cloneConfig(theme.config) }))
      : [],
  };
}

export function normalizeThemeConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const next = { ...defaultConfig };
  colorKeys.forEach((key) => {
    if (typeof source[key] === 'string' && hexColor.test(source[key])) next[key] = source[key];
  });
  if (allowedPatterns.has(source.pattern)) next.pattern = source.pattern;
  if (allowedGradients.has(source.gradient)) next.gradient = source.gradient;
  if (allowedFonts.has(source.font)) next.font = source.font;
  if (Number.isFinite(source.radius)) next.radius = Math.max(0, Math.min(32, source.radius));
  if (Number.isFinite(source.brightness)) next.brightness = Math.max(55, Math.min(130, source.brightness));
  if (Number.isFinite(source.transparency)) next.transparency = Math.max(45, Math.min(100, source.transparency));
  return next;
}

function legacyConfig(legacyTheme) {
  if (!legacyTheme || typeof legacyTheme !== 'object') return null;
  const hasLegacyColors = ['app', 'surface', 'sidebar', 'accent', 'outgoing', 'incoming'].some((key) => hexColor.test(legacyTheme[key] || ''));
  if (!hasLegacyColors) return null;
  return normalizeThemeConfig(legacyTheme);
}

export function resolveTheme(settings, legacyTheme) {
  const hasSavedSettings = settings && typeof settings === 'object' && typeof settings.selectedThemeId === 'string';
  const normalized = createThemeSettings(settings);
  const allThemes = [...themeCatalog, ...normalized.customThemes.map((theme) => ({ ...theme, family: 'Custom', source: 'custom' }))];
  if (!hasSavedSettings) {
    const legacy = legacyConfig(legacyTheme);
    if (legacy) return { id: 'legacy-theme', name: 'Previous theme', family: 'Custom', source: 'legacy', config: legacy, settings: normalized, themes: allThemes };
  }
  const chosen = allThemes.find((theme) => theme.id === normalized.selectedThemeId) || themeCatalog.find((theme) => theme.id === defaultThemeId);
  return { ...chosen, config: normalizeThemeConfig(chosen.config), settings: normalized, themes: allThemes };
}

function patternImage(pattern, color) {
  const ink = `${color}18`;
  const patterns = {
    none: 'none',
    dots: `radial-gradient(${ink} 1px, transparent 1px)`,
    grid: `linear-gradient(90deg, ${ink} 1px, transparent 1px), linear-gradient(${ink} 1px, transparent 1px)`,
    waves: `repeating-radial-gradient(ellipse at 10% 100%, ${ink} 0 1px, transparent 2px 18px)`,
    clouds: `radial-gradient(circle at 25% 25%, ${ink} 0 12px, transparent 13px)`,
    stars: `radial-gradient(${ink} 1px, transparent 1.5px)`,
    hearts: `radial-gradient(circle at 35% 35%, ${ink} 0 3px, transparent 4px)`,
    leaves: `radial-gradient(ellipse at 30% 40%, ${ink} 0 5px, transparent 6px)`,
    doodle: `repeating-linear-gradient(45deg, transparent 0 12px, ${ink} 13px 14px)`,
    sun: `repeating-conic-gradient(from 0deg at 85% 15%, ${ink} 0 6deg, transparent 7deg 16deg)`,
    snow: `radial-gradient(${ink} 1px, transparent 2px)`,
    confetti: `linear-gradient(45deg, transparent 46%, ${ink} 47% 53%, transparent 54%)`,
  };
  return patterns[pattern] || 'none';
}

function gradientImage(gradient) {
  const gradients = {
    none: 'none',
    instagram: 'linear-gradient(135deg, #feda75 0%, #fa7e1e 25%, #d62976 55%, #962fbf 78%, #4f5bd5 100%)',
    'violet-pink': 'linear-gradient(135deg, #7c3aed, #ec4899)',
    sunset: 'linear-gradient(135deg, #f59e0b, #f97316, #ec4899)',
    midnight: 'linear-gradient(135deg, #0f172a, #312e81)',
    galaxy: 'linear-gradient(135deg, #111827, #312e81, #7c3aed)',
    aurora: 'linear-gradient(135deg, #0f766e, #22d3ee, #818cf8)',
    cyber: 'linear-gradient(135deg, #ec4899, #7c3aed, #06b6d4)',
  };
  return gradients[gradient] || 'none';
}

function brightnessOverlay(brightness) {
  if (brightness === 100) return 'rgba(0, 0, 0, 0)';
  if (brightness < 100) return `rgba(0, 0, 0, ${(100 - brightness) / 175})`;
  return `rgba(255, 255, 255, ${(brightness - 100) / 150})`;
}

export function themeCssVars(settings, legacyTheme) {
  const { config } = resolveTheme(settings, legacyTheme);
  const font = { system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', serif: 'Georgia, "Times New Roman", serif', rounded: 'ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' }[config.font];
  return {
    '--theme-app': config.app,
    '--theme-surface': config.surface,
    '--theme-sidebar': config.sidebar,
    '--theme-accent': config.accent,
    '--theme-outgoing': config.outgoing,
    '--theme-incoming': config.incoming,
    '--theme-text': config.text,
    '--theme-muted': config.muted,
    '--theme-outgoing-text': config.outgoingText,
    '--theme-incoming-text': config.incomingText,
    '--theme-header': config.header,
    '--theme-input': config.input,
    '--theme-send': config.send,
    '--theme-timestamp': config.timestamp,
    '--theme-radius': `${config.radius}px`,
    '--theme-font': font,
    '--theme-pattern': patternImage(config.pattern, config.accent),
    '--theme-gradient': gradientImage(config.gradient),
    '--theme-overlay': brightnessOverlay(config.brightness),
    '--theme-surface-alpha': `${config.transparency}%`,
  };
}

export const customThemeOptions = {
  patterns: [...allowedPatterns],
  gradients: [...allowedGradients],
  fonts: [...allowedFonts],
  colorKeys,
};
