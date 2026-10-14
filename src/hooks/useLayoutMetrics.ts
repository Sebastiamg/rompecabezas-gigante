import { useLayoutEffect, useState, type RefObject } from 'react';
import { computeFreeRect, layoutRect, relativeRect, sameMetrics, type LayoutMetrics } from '../interaction/layout';

/**
 * Mide el DOM (lienzo, HUD, bandeja y huecos de la bandeja) y lo expone
 * para la escena 3D. Solo cambia al redimensionar o reordenar la bandeja,
 * nunca durante el juego normal.
 */
export function useLayoutMetrics(
  rootRef: RefObject<HTMLElement | null>,
  hudRef: RefObject<HTMLElement | null>,
  trayRef: RefObject<HTMLElement | null>,
  /** Cambia cuando cambian los huecos (p. ej. orden de la bandeja tras reiniciar). */
  layoutKey: string,
  /** Tarjeta superpuesta (opcional) que el encuadre del modelo debe evitar. */
  occluderRef?: RefObject<HTMLElement | null>,
): LayoutMetrics | null {
  const [metrics, setMetrics] = useState<LayoutMetrics | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const origin = root.getBoundingClientRect();
      if (origin.width < 1 || origin.height < 1) return;
      const hud = hudRef.current ? relativeRect(hudRef.current, origin) : null;
      const tray = trayRef.current ? relativeRect(trayRef.current, origin) : null;
      const occluderElement = occluderRef?.current;
      const occluder = occluderElement?.isConnected ? layoutRect(occluderElement, root) : null;
      const slots: Record<string, ReturnType<typeof relativeRect>> = {};
      trayRef.current?.querySelectorAll<HTMLElement>('[data-tray-slot]').forEach((element) => {
        const id = element.dataset.traySlot;
        if (id) slots[id] = relativeRect(element, origin);
      });
      const next: LayoutMetrics = {
        width: origin.width,
        height: origin.height,
        free: computeFreeRect(origin.width, origin.height, hud ? hud.y + hud.height : 0, tray, occluder),
        trayRect: tray,
        slots,
      };
      setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    if (hudRef.current) observer.observe(hudRef.current);
    if (trayRef.current) observer.observe(trayRef.current);
    if (occluderRef?.current) observer.observe(occluderRef.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef, hudRef, trayRef, layoutKey, occluderRef]);

  return metrics;
}
