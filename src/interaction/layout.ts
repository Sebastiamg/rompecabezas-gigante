import type { Rect } from './interactionStore';

/**
 * Medidas del DOM que la escena 3D necesita: tamaño del lienzo, zona
 * libre (sin HUD ni bandeja) para encuadrar el modelo y la posición de
 * cada hueco de la bandeja para colocar ahí las piezas 3D.
 * El CSS decide el layout (responsive, safe areas); el 3D lo sigue.
 */
export interface LayoutMetrics {
  width: number;
  height: number;
  free: Rect;
  trayRect: Rect | null;
  /** Área visual de la pieza dentro de cada hueco de la bandeja (px, relativos al lienzo). */
  slots: Readonly<Record<string, Rect>>;
}

export function relativeRect(element: Element, origin: DOMRect): Rect {
  const r = element.getBoundingClientRect();
  return { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height };
}

/** Rectángulo de maquetación sin transformaciones CSS (las animaciones de entrada no alteran la medida). */
export function layoutRect(element: HTMLElement, root: HTMLElement): Rect {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, width: element.offsetWidth, height: element.offsetHeight };
}

const score = (r: Rect) => Math.min(r.width, r.height);

/** Recorta la zona libre con un obstáculo: se queda con la parte de encima o la de la izquierda. */
function clipBy(free: Rect, obstacle: Rect): Rect {
  const above: Rect = { ...free, height: Math.max(1, Math.min(free.y + free.height, obstacle.y) - free.y) };
  const left: Rect = { ...free, width: Math.max(1, Math.min(free.x + free.width, obstacle.x) - free.x) };
  return score(left) > score(above) ? left : above;
}

/**
 * Zona libre para encuadrar el modelo: bajo el HUD y sin la bandeja (abajo o a
 * la derecha). Si hay una tarjeta superpuesta (p. ej. la final), también se evita.
 */
export function computeFreeRect(
  width: number,
  height: number,
  hudBottom: number,
  tray: Rect | null,
  occluder: Rect | null = null,
): Rect {
  const top = Math.max(0, hudBottom);
  let free: Rect = { x: 0, y: top, width, height: Math.max(1, height - top) };
  if (tray) free = clipBy(free, tray);
  if (occluder) free = clipBy(free, occluder);
  return free;
}

export function sameMetrics(a: LayoutMetrics | null, b: LayoutMetrics): boolean {
  if (!a) return false;
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5;
  const sameRect = (r1: Rect | null | undefined, r2: Rect | null | undefined) =>
    r1 === r2 ||
    (!!r1 && !!r2 && close(r1.x, r2.x) && close(r1.y, r2.y) && close(r1.width, r2.width) && close(r1.height, r2.height));
  if (!close(a.width, b.width) || !close(a.height, b.height)) return false;
  if (!sameRect(a.free, b.free) || !sameRect(a.trayRect, b.trayRect)) return false;
  const keysA = Object.keys(a.slots);
  const keysB = Object.keys(b.slots);
  if (keysA.length !== keysB.length) return false;
  return keysB.every((key) => sameRect(a.slots[key], b.slots[key]));
}
