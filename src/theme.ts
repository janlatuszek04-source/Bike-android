export const theme = {
  bg: '#0F172A',
  bgElevated: '#1E293B',
  bgCard: '#1E293B',
  bgCardAlt: '#0B1220',
  border: '#334155',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  accent: '#84CC16',
  accentDim: '#65A30D',
  accentGlow: 'rgba(132, 204, 22, 0.35)',
  warn: '#FACC15',
  warnDim: '#CA8A04',
  danger: '#EF4444',
  dangerDim: '#B91C1C',
  mapTile: '#0B1220',
} as const;

export type Theme = typeof theme;
