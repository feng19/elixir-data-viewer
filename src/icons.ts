/**
 * Inline SVG icons for the viewer chrome.
 * One 16×16 grid, 1.5px round strokes, currentColor. All strings are
 * static constants (never built from user data), so they are safe to inject.
 */
const svg = (body: string) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  search: svg('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.5 13.5"/>'),
  filter: svg('<path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5V8.5z"/>'),
  foldAll: svg('<path d="M4 6l4-3 4 3"/><path d="M4 10l4 3 4-3"/>'),
  unfoldAll: svg('<path d="M4 4.5l4 3 4-3"/><path d="M4 11.5l4-3 4 3"/>'),
  minus: svg('<path d="M3.5 8h9"/>'),
  plus: svg('<path d="M3.5 8h9M8 3.5v9"/>'),
  wrap: svg('<path d="M2.5 4h11"/><path d="M2.5 8h8.5a2.25 2.25 0 0 1 0 4.5H8.5"/><path d="M10 10.75 8.25 12.5 10 14.25" transform="translate(0 -1)"/>'),
  copy: svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
  check: svg('<path d="M3 8.5l3.25 3.25L13 4.75"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  up: svg('<path d="M4 9.5l4-4 4 4"/>'),
  down: svg('<path d="M4 6.5l4 4 4-4"/>'),
  clear: svg('<path d="M2.5 4.5h11"/><path d="M6 4.5V3h4v1.5"/><path d="M4 4.5l.6 8h6.8l.6-8"/>'),
  chevron: svg('<path d="M6 3.5 10.5 8 6 12.5"/>'),
} as const;
