import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { geometryKey, peekGeometry, releaseGeometry, retainGeometry } from '../three/geometryFactory';
import type { GeometryConfig, PieceAppearance } from '../types/puzzle';

/**
 * Geometría compartida y cacheada: dos piezas (o una pieza y su silueta)
 * con la misma configuración usan la misma BufferGeometry, y se libera
 * de la GPU cuando ya nadie la usa.
 */
export function useSharedGeometry(config: GeometryConfig, appearance: PieceAppearance): BufferGeometry {
  const key = geometryKey(config, appearance);
  // `key` resume config + apariencia, así que es la única dependencia necesaria.
  const geometry = useMemo(() => peekGeometry(key, config, appearance), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    retainGeometry(key);
    return () => releaseGeometry(key);
  }, [key]);
  return geometry;
}
