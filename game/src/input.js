// Keyboard and mouse: WASD or arrows to move, hold Shift to sneak, hold
// nothing to walk, hold... running is the default fast gait on purpose —
// press Space to walk quietly? No: keep it simple and readable on screen.
//   - WASD / arrows: move
//   - Shift (hold): sneak — slow, silent, hard to spot
//   - run is automatic when you push a direction fully... no. Keys:
//   - W/A/S/D or arrows move; Shift sneaks; Alt or Space... final:
//   - Shift = sneak, and moving while holding nothing is a walk; double-tap
//     a direction or hold Ctrl to run. Ctrl is awkward; use this instead:
//   - hold Shift to sneak; hold Space to run. Both are shown on the HUD.
// Click (or tap) anywhere: throw a distraction coin toward that point.
// P or Escape: pause. M: mute. R: restart the level. Enter: confirm.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';
export const ACTION_SMOKE = 'smoke';

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    run: false,
    click: null, // { x, y } in canvas pixels, consumed by the game
    actions: new Set(),
  };

  function updateVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    input.mx = x;
    input.my = y;
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.run = keys.has('Space');
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter') input.actions.add(ACTION_CONFIRM);
    if (event.code === 'KeyP' || event.code === 'Escape') input.actions.add(ACTION_PAUSE);
    if (event.code === 'KeyM') input.actions.add(ACTION_MUTE);
    if (event.code === 'KeyR') input.actions.add(ACTION_RESTART);
    if (event.code === 'KeyQ') input.actions.add(ACTION_SMOKE);
    updateVector();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    updateVector();
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    input.click = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      button: event.button, // 0 = left (coin), 2 = right (smoke)
    };
  }

  function onContextMenu(event) {
    event.preventDefault(); // right-click throws smoke, never opens a menu
  }

  function onBlur() {
    keys.clear();
    updateVector();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  input.takeClick = () => {
    const click = input.click;
    input.click = null;
    return click;
  };
  input.takeAction = (action) => {
    const had = input.actions.has(action);
    input.actions.delete(action);
    return had;
  };
  input.destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('blur', onBlur);
  };
  return input;
}
