export const DEFAULT_THEME = Object.freeze({
  app: '#282c35',
  surface: '#fafafa',
  sidebar: '#ffffff',
  accent: '#319268',
  outgoing: '#268d61',
  incoming: '#f0f0f0',
});

const hexColor = /^#[0-9a-f]{6}$/i;

export function normalizeTheme(theme) {
  const source = theme && typeof theme === 'object' ? theme : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_THEME).map(([key, fallback]) => [
      key,
      typeof source[key] === 'string' && hexColor.test(source[key]) ? source[key] : fallback,
    ])
  );
}

export function themeCssVars(theme) {
  const colors = normalizeTheme(theme);
  return {
    '--theme-app': colors.app,
    '--theme-surface': colors.surface,
    '--theme-sidebar': colors.sidebar,
    '--theme-accent': colors.accent,
    '--theme-outgoing': colors.outgoing,
    '--theme-incoming': colors.incoming,
  };
}
