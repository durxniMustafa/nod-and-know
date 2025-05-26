export function simpleConfetti() {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '0';
  container.style.overflow = 'visible';
  container.style.pointerEvents = 'none';

  const pieces = 30;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('div');
    piece.style.position = 'absolute';
    piece.style.width = '8px';
    piece.style.height = '8px';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left = Math.random() * 100 + '%';
    piece.style.transform = `translateY(-10px) rotate(${Math.random() * 360}deg)`;
    piece.style.opacity = '1';
    piece.style.transition = 'transform 700ms ease-out, opacity 700ms ease-out';
    container.appendChild(piece);
    requestAnimationFrame(() => {
      piece.style.transform = `translateY(${window.innerHeight}px) rotate(${Math.random() * 720}deg)`;
      piece.style.opacity = '0';
    });
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 800);
}
