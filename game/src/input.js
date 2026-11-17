// Keyboard and mouse input, kept as a plain set of pressed keys.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false },
    pressed: new Set(), // keys hit since the last frame was consumed
  };

  const code = (e) => e.code;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouse.down = true;
    input.pressed.add('Mouse0');
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });

  input.isDown = (...codes) => codes.some((c) => input.keys.has(c));
  input.wasPressed = (c) => input.pressed.has(c);
  input.endFrame = () => input.pressed.clear();
  // Drop every held key, e.g. when the game pauses or the tab loses focus.
  input.clear = () => { input.keys.clear(); input.pressed.clear(); input.mouse.down = false; };
  return input;
}
