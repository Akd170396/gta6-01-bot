// Keyboard and mouse input. Keys are tracked by code (KeyW, ArrowUp, ...),
// the mouse by canvas pixels, converted to world coordinates by the camera.

// createInput wires listeners onto the window and canvas and returns the
// live input state object the game loop reads every frame.
export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {}, // edge-triggered: true only on the frame the key went down
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    wheel: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

// endFrameInput clears the edge-triggered flags after each frame.
export function endFrameInput(input) {
  input.pressed = {};
  input.mousePressed = false;
  input.wheel = 0;
}

// isDown checks a held key by code.
export function isDown(input, ...codes) {
  return codes.some((c) => input.keys[c]);
}

// wasPressed checks a key that went down this frame.
export function wasPressed(input, ...codes) {
  return codes.some((c) => input.pressed[c]);
}

// moveVector returns the normalized WASD / arrow movement vector.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (isDown(input, 'KeyA', 'ArrowLeft')) x -= 1;
  if (isDown(input, 'KeyD', 'ArrowRight')) x += 1;
  if (isDown(input, 'KeyW', 'ArrowUp')) y -= 1;
  if (isDown(input, 'KeyS', 'ArrowDown')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 0) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
