function candy(type, artwork) {
  const id = `candy-${type}`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="candy-art"><defs><linearGradient id="${id}-body" x1=".2" y1="0" x2=".75" y2="1"><stop stop-color="var(--candy-light)"/><stop offset=".34" stop-color="var(--candy-main)"/><stop offset="1" stop-color="var(--candy-dark)"/></linearGradient><linearGradient id="${id}-shine" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="white" stop-opacity=".88"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><g fill="url(#${id}-body)" stroke="var(--candy-dark)" stroke-opacity=".54" stroke-width="1.1" stroke-linejoin="round">${artwork}</g></svg>`;
}

export const pieceIcons = [
  // Purple sugar cluster
  candy(0, `<path d="M23 8c4-5 11-2 10 4 6-3 11 3 7 8 6 2 5 10-1 11 2 7-5 11-10 7-3 6-11 4-12-2-7 1-10-6-5-11-5-5-1-12 5-11-1-6 3-9 6-6Z"/><ellipse cx="16" cy="15" rx="6" ry="2.8" transform="rotate(-30 16 15)" fill="url(#candy-0-shine)" stroke="none"/><path d="M12 25c-1 7 4 12 10 13" fill="none" stroke="white" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>`),
  // Blue gumdrop
  candy(1, `<path d="M24 5c9 0 16 7 16 16 0 10-7 21-16 21S8 31 8 21C8 12 15 5 24 5Z"/><ellipse cx="17" cy="13" rx="6.2" ry="3.2" transform="rotate(-32 17 13)" fill="url(#candy-1-shine)" stroke="none"/><path d="M13 23c1 7 5 12 10 14" fill="none" stroke="white" stroke-opacity=".22" stroke-width="2.2" stroke-linecap="round"/>`),
  // Red jelly bean
  candy(2, `<path d="M13 8c6-2 10 4 12 10 2 6 8 12 5 18-3 6-13 5-19-2C4 26 5 12 13 8Z"/><ellipse cx="15" cy="14" rx="5.8" ry="2.8" transform="rotate(48 15 14)" fill="url(#candy-2-shine)" stroke="none"/><path d="M11 21c2 7 7 12 13 14" fill="none" stroke="white" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>`),
  // Green rounded sugar cube
  candy(3, `<path d="m11 8 24-1 5 5v24l-5 5H11l-5-5V13l5-5Z"/><path d="m11 8 5 5v28m24-29-5 5H6" fill="none" stroke="white" stroke-opacity=".25" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12h13" fill="none" stroke="url(#candy-3-shine)" stroke-width="3" stroke-linecap="round"/>`),
  // Orange hard-candy disc
  candy(4, `<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="13.5" fill="none" stroke="white" stroke-opacity=".22" stroke-width="1.3"/><ellipse cx="18" cy="13" rx="6" ry="2.8" transform="rotate(-28 18 13)" fill="url(#candy-4-shine)" stroke="none"/><path d="M12 24c0 7 5 13 11 15" fill="none" stroke="white" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>`),
  // Yellow teardrop sweet
  candy(5, `<path d="M24 5C21 12 9 22 9 30a15 15 0 0 0 30 0C39 22 27 12 24 5Z"/><ellipse cx="18" cy="19" rx="5.8" ry="2.7" transform="rotate(-48 18 19)" fill="url(#candy-5-shine)" stroke="none"/><path d="M13 30c0 6 4 10 9 11" fill="none" stroke="white" stroke-opacity=".24" stroke-width="2" stroke-linecap="round"/>`)
];
