/** Renotes' own icon set: 24×24, 1.6px rounded strokes. */
export const ICONS = {
  sidebar: '<rect x="3" y="4.5" width="18" height="15" rx="3.2"/><path d="M9.5 4.5v15"/><path d="M5.6 8h1.6M5.6 10.8h1.6"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.8" cy="7" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17" r=".9" fill="currentColor"/>',
  gallery: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6.5 6.5l.9 12.2A2 2 0 0 0 9.4 20.5h5.2a2 2 0 0 0 2-1.8l.9-12.2"/><path d="M10.2 10.5v6M13.8 10.5v6"/>',
  compose: '<path d="M12 4.5H7A3 3 0 0 0 4 7.5v9.5a3 3 0 0 0 3 3h9.5a3 3 0 0 0 3-3V12"/><path d="M17.8 3.7a1.8 1.8 0 0 1 2.5 2.5l-7.6 7.6-3.3.8.8-3.3z"/>',
  format: '<path d="M3 18.5 8 5.5l5 13"/><path d="M5 13.5h6"/><circle cx="17.3" cy="15.6" r="2.9"/><path d="M20.2 12.4v6.1"/>',
  checklist: '<circle cx="5.5" cy="7" r="2.2"/><path d="m4.5 7 .8.8 1.4-1.6"/><circle cx="5.5" cy="16.5" r="2.2"/><path d="M10.5 7h10M10.5 16.5h10"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15"/>',
  attach: '<path d="m19 11.5-6.6 6.6a4.4 4.4 0 0 1-6.2-6.2l7.1-7.1a2.9 2.9 0 0 1 4.1 4.1l-7 7a1.45 1.45 0 0 1-2.05-2.05l6.3-6.3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  folder: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3H18a2.5 2.5 0 0 1 2.5 2.5v7.5A2.5 2.5 0 0 1 18 19.5H6a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M3.5 10h17"/>',
  smartFolder: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3H18a2.5 2.5 0 0 1 2.5 2.5v7.5A2.5 2.5 0 0 1 18 19.5H6a2.5 2.5 0 0 1-2.5-2.5z"/><circle cx="12" cy="13.6" r="1.9"/><path d="M12 10.2v1.1M12 15.9V17M15.4 13.6h-1.1M9.7 13.6H8.6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  plusCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 4.5h6l-1 5 3 3v1.5H7V12.5l3-3z"/><path d="M12 14v6"/>',
  clear: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" stroke="var(--clear-x, #fff)"/>',
  recover: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
} as const;

export type IconName = keyof typeof ICONS;
