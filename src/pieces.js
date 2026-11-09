function gem(type, shape) {
  const id = `g${type}`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="gem-art"><defs><radialGradient id="${id}a" cx="30%" cy="18%" r="85%"><stop stop-color="var(--gem-light)"/><stop offset=".5" stop-color="var(--gem-color)"/><stop offset="1" stop-color="var(--gem-shadow)"/></radialGradient><linearGradient id="${id}b" x2=".8" y2="1"><stop stop-color="white" stop-opacity=".95"/><stop offset="1" stop-color="white" stop-opacity=".08"/></linearGradient></defs><path d="${shape}" fill="url(#${id}a)" stroke="rgba(255,255,255,.64)" stroke-width="1.4"/><path d="M24 6 24 42M8 18 40 18" stroke="white" stroke-opacity=".26" stroke-width="1.2"/><ellipse cx="16" cy="12" rx="6" ry="2.8" transform="rotate(-28 16 12)" fill="url(#${id}b)"/><circle cx="35" cy="32" r="2" fill="white" opacity=".68"/></svg>`;
}

export const pieceIcons = [
  gem(0, "M29 4C16 5 8 15 11 28c3 12 15 17 26 10C25 37 17 25 29 4Z"),
  gem(1, "M24 3 29 17 44 24 29 29 24 45 19 30 4 24 19 18Z"),
  gem(2, "M24 18C15 5 5 15 16 24 5 33 15 43 24 30c9 13 19 3 8-6 11-9 1-19-8-6Z"),
  gem(3, "M24 3 31 17 45 24 31 31 24 45 17 31 3 24 17 17Z"),
  gem(4, "M42 6C24 5 9 11 7 25 5 37 18 42 27 34 37 26 40 15 42 6Z"),
  gem(5, "M24 3 29 15 42 10 36 23 47 29 33 31 35 45 24 36 14 46 16 32 3 29 15 22 9 10 22 15Z")
];
