# 🧩 Rompecabezas Gigante — motor de rompecabezas educativos 3D

MVP funcional de un **motor reutilizable** para construir modelos educativos en 3D pieza por pieza.
Incluye tres rompecabezas, cada uno definido solo con un archivo de configuración:

| | Rompecabezas | Piezas | Lo que se aprende |
| --- | --- | --- | --- |
| 🌎 | **Estructura interna de la Tierra** | Núcleo interno, núcleo externo, manto, corteza | Orden y características de las capas |
| 🧬 | **La célula animal** | Membrana, citoplasma, núcleo (con nucléolo), 2 mitocondrias, ribosomas, retículo endoplasmático, aparato de Golgi, lisosoma | Forma y función de cada orgánulo |
| 💧 | **Molécula de agua (H₂O)** | Oxígeno, 2 hidrógenos, 2 enlaces covalentes | Átomo central, enlaces, geometría angular (104,5°) y pares libres |

Al abrir la app aparece un **catálogo** para elegir; cada rompecabezas también se abre directamente
con `?puzzle=earth-layers`, `?puzzle=animal-cell` o `?puzzle=water-molecule`. El motor no sabe nada
de capas, orgánulos ni átomos: todo el contenido vive en `src/data/`.

Stack: **Vite + React 19 + TypeScript + Tailwind CSS 4 + three.js + React Three Fiber + drei**
(de drei solo se usa `OrbitControls`). Sin otras dependencias de ejecución.

---

## Ejecutar

Requisito: Node.js ≥ 20.19.

```bash
npm install
npm run dev          # http://localhost:5190
```

Para probar en un teléfono de la misma red Wi‑Fi:

```bash
npm run dev:host     # abre en el teléfono la URL "Network" que muestra la consola
```

Otros comandos:

```bash
npm run build        # comprobación de tipos + build de producción en dist/
npm run preview      # sirve dist/
npm run typecheck
```

Compatible con Chrome, Edge, Safari, Android Chrome e iOS Safari (pointer events + WebGL 2/1).

## Cómo se juega

| Acción | Táctil | Ratón | Teclado |
| --- | --- | --- | --- |
| Tomar una pieza | Arrastrar desde la bandeja | Arrastrar desde la bandeja | Tab + Enter (seleccionar) |
| Colocarla | Soltar sobre el modelo, o tocar la pieza y luego tocar su lugar | Igual | ← → eligen el lugar, Enter coloca |
| Girar la pieza | Botón ⟳ de la barra de selección | Igual, o tecla R | R |
| Girar la vista | Arrastrar en un espacio libre | Arrastrar en un espacio libre | — |
| Zoom | Pellizcar | Rueda | — |
| Vista inicial | Botón ↻ | Botón ↻ | — |
| Pista | Botón 💡 (HUD o barra de selección) | Igual | — |
| Soltar selección | ✕ o tocar fuera del modelo | Igual | Escape |
| Reiniciar / elegir otro rompecabezas | Botón ☰ Opciones | Igual | — |

Soltar una pieza sobre la bandeja la devuelve sin contar intento.

---

## Arquitectura

```
src/
├── types/puzzle.ts            Tipos del dominio (configuración, estado, eventos, métricas)
├── engine/                    MOTOR PURO (sin React; three solo como librería matemática)
│   ├── puzzleRuntime.ts       Config → runtime: defaults, slots y zonas resueltas, avisos de config
│   ├── puzzleValidator.ts     Zonas, findZoneAt(), isCorrectPlacement(), evaluateDrop()
│   ├── puzzleState.ts         Reducer puro + selectores (métricas, pista objetivo...)
│   ├── difficulty.ts          Perfiles easy / medium / hard
│   ├── feedback.ts            Evento del motor → mensaje educativo (desde la config)
│   ├── labels.ts              Textos de interfaz por defecto (sobrescribibles por puzzle)
│   └── puzzleUtils.ts         Conversión de tuplas, aleatoriedad con semilla, formato
├── interaction/               Puente DOM ↔ 3D de alta frecuencia (sin renders de React)
│   ├── interactionStore.ts    Estado mutable: arrastre, bandeja, giros, pistas visuales
│   ├── trayOrientation.ts     Orientación de las piezas en la bandeja (relativa a la cámara)
│   └── layout.ts              Medidas del DOM que usa la escena (zona libre, huecos)
├── three/                     Recursos 3D genéricos
│   ├── geometryFactory.ts     Registro tipado de geometrías + caché con conteo de referencias
│   ├── sphereShell.ts         Cáscara esférica con recorte (1 draw call, colores por vértice)
│   ├── surfacePaint.ts        Patrones procedurales por vértice (sólido, ruido, terreno)
│   ├── materials.ts           Pieza (brillo de borde), contorno, holograma, guías, halo
│   ├── modelBounds.ts         Radio del modelo y de cada pieza
│   └── animation.ts           Amortiguación independiente de FPS y curvas de easing
├── hooks/
│   ├── usePuzzle.ts           Estado + acciones (useReducer sobre el motor)
│   ├── usePuzzleInteraction.ts  Gestos 3D: arrastre, tocar‑para‑colocar, cancelaciones
│   ├── usePuzzleProgress.ts   Progreso derivado + eventos de aprendizaje (onEvent)
│   ├── useLayoutMetrics.ts    Mide HUD, bandeja y huecos (ResizeObserver)
│   └── useSharedGeometry.ts   Geometría compartida y liberada automáticamente
├── components/
│   ├── Puzzle/
│   │   ├── PuzzleExperience.tsx  Orquestador (motor + escena + interfaz)
│   │   ├── PuzzleScene.tsx       <Canvas> bajo demanda
│   │   ├── PuzzleCamera.tsx      Encuadre responsive, OrbitControls, animaciones de cámara, luces
│   │   ├── PuzzleModel.tsx       Siluetas de lugares vacíos, guías de zona, decoraciones
│   │   ├── PuzzlePiece.tsx       Pieza 3D genérica (máquina de estados visual en useFrame)
│   │   ├── PuzzlePiecePanel.tsx  Bandeja (huecos HTML accesibles sobre piezas 3D reales)
│   │   ├── PuzzleHUD.tsx         Título, progreso, pista, vista, reiniciar
│   │   ├── PuzzleFeedback.tsx    Aviso, tarjeta educativa, barra de selección
│   │   ├── PuzzleHint.tsx        Tarjeta de pista
│   │   ├── PuzzleInstructions.tsx  Pantalla inicial
│   │   └── PuzzleCompletion.tsx  Recompensa final + métricas
│   ├── Catalog/PuzzleCatalog.tsx  Pantalla de inicio (lista genérica de rompecabezas)
│   └── UI/                    Botones, iconos SVG en línea, hoja de opciones, diálogo de confirmación
├── data/
│   ├── earthPuzzle.ts         ← TODO el contenido de la Tierra
│   ├── cellPuzzle.ts          ← TODO el contenido de la célula animal
│   ├── waterMoleculePuzzle.ts ← TODO el contenido de la molécula de agua
│   └── index.ts               Catálogo (?puzzle=<id>)
├── App.tsx · main.tsx · index.css
```

```
                 PUZZLE ENGINE (engine/ + hooks/ + components/)
                                │
        ┌───────────────────────┴───────────────────────┐
   CONFIGURACIÓN (data/)                         INTERACCIÓN
   earthPuzzle.ts → célula → mapa…               pointer events → rayo → plano
        │                                              │
   runtime (slots + zonas)  ───────────────►  VALIDACIÓN (puzzleValidator)
                                                       │
                                            ESTADO (reducer) → feedback, métricas
```

### Separación motor ↔ contenido

- **Pieza ≠ lugar ≠ modelo.** Cada pieza declara su `targetTransform` y su `dropZone`; de ahí el
  runtime deriva los *slots* (lugares). `matchGroup` permite piezas intercambiables (los dos H del
  H₂O pueden ir a cualquiera de los dos lugares de H). El *modelo* (`model`) agrupa lo que no es pieza:
  ancla, cámara, silueta, decoraciones.
- El motor nunca ramifica por id de pieza ni por tipo de modelo (`model.category` es solo
  metadato). Cambiar de contenido no requiere tocar `PuzzlePiece.tsx`, `PuzzleScene.tsx`,
  `usePuzzle.ts` ni `puzzleValidator.ts`.
- Textos de interfaz, pistas, información educativa y retroalimentación de errores salen de la
  configuración (`labels`, `hints`, `info`, `feedback`).

### Cómo funciona el arrastre 3D

1. La bandeja es una fila de **botones HTML transparentes** situados exactamente sobre **piezas 3D
   reales** (el CSS decide el layout; la escena mide los huecos y coloca ahí cada pieza).
2. `pointerdown` en un hueco → `store.controller.begin()`. Desde ese momento los movimientos se
   escuchan en `window` (siguen funcionando aunque el dedo salga del lienzo o pase por encima de la
   interfaz). Así, arrastrar "del panel a la escena" es igual de robusto con dedo, ratón o lápiz.
3. Superado un umbral (4 px ratón / 9 px dedo) empieza el arrastre. En cada `pointermove` se lanza un
   rayo cámara → puntero:
   - la pieza se dibuja **sobre ese rayo a profundidad fija delante del modelo**: nunca queda oculta,
     se ve "levantada" (escala 1,25 + contorno + brillo de borde) y sigue al dedo con amortiguación;
   - en táctil la pieza va **64 px por encima del dedo** para que la mano no la tape;
   - el **punto de suelta** es la intersección del rayo con el **plano de arrastre**
     (`interaction.dragPlane`: de frente a la cámara, o fijo —p. ej. el plano de un mapa—).
4. La zona bajo el punto se resalta mientras se arrastra (silueta + anillos de guía, según dificultad).
5. Sin movimiento = toque = seleccionar. Con una pieza seleccionada, tocar el modelo la intenta
   colocar ahí (alternativa sin arrastre).

Las posiciones por frame viven en refs / el store mutable y se escriben directamente en los
`Object3D` dentro de `useFrame`: **React solo se re-renderiza en eventos discretos** (seleccionar,
empezar a arrastrar, soltar, pista).

### Cámara vs. pieza (sin conflictos)

- El arrastre de pieza **solo** puede empezar en un hueco de pieza (botón HTML), nunca en el lienzo;
  los gestos sobre espacio libre llegan a `OrbitControls` (rotar 1 dedo, pellizcar, rueda).
- Mientras hay una pieza en la mano `OrbitControls` se desactiva: un segundo dedo no mueve la cámara.
- La bandeja va **pegada a la cámara** (espacio de vista): orbitar o hacer zoom no desordena las piezas.
- La cámara usa *lens shift* (`setViewOffset`) para centrar el modelo en la zona libre entre el HUD y
  la bandeja, y calcula la distancia para que quepa en cualquier pantalla. En pantallas anchas limita
  el campo de visión horizontal y cada pieza de la bandeja **compensa la distorsión de perspectiva**.
- Si aparece una tarjeta grande (la de la recompensa final), la cámara **reencuadra el modelo con una
  transición suave** en el espacio que queda libre: la interfaz nunca tapa lo que se construyó.

### Validación

`findZoneAt()` busca la zona bajo el punto usando una **distancia firmada** (negativa dentro):
gana la de mayor `priority` y, a igual prioridad, la más "profunda" dentro de
`snapThreshold × multiplicador de dificultad`. Tipos de zona: `sphere` (alrededor de un punto: mapas,
moléculas, orgánulos) y `shell` (banda radial: capas concéntricas, órbitas). Una prioridad negativa
crea una zona "de fondo" (el citoplasma: todo el interior que no sea un orgánulo).
`isCorrectPlacement()` comprueba, según `validation`:

| Comprobación | Motivo de rechazo |
| --- | --- |
| No es una zona trampa (`model.decoys`) | `decoy` |
| La zona pertenece a la pieza (o a su `matchGroup`) | `wrong-zone` |
| El lugar está libre | `occupied` |
| Están colocadas las piezas de `requires` | `requires` |
| Orientación dentro de `rotationTolerance` (si `rotation: true`) | `rotation` |
| Escala dentro de `scaleTolerance` (si `scale: true`) | `scale` |

Soltar fuera de toda zona = `missed` (vuelve sin contar error). Acierto → *snap* interpolado
(posición, rotación y escala) hasta el objetivo y bloqueo (`lockOnPlace`). Error → sacudida en el
sitio, destello coral suave y regreso a la bandeja, con un mensaje que **enseña algo sobre la zona
donde se soltó** (`feedback.wrongZone[otraPieza]` o `zoneDescription`).

Cómo lo aprovecha cada contenido:

- **Tierra:** todas las capas comparten centro, así que el lugar de cada una es su **profundidad**
  (zonas `shell`). La corteza tiene más margen hacia fuera (es fina y no debe exigir precisión).
- **Célula:** cada orgánulo tiene su silueta (zona `sphere`); el retículo usa una banda `shell`
  alrededor del núcleo; el citoplasma es la zona de fondo (`priority: -1`). Las dos mitocondrias son
  intercambiables (`matchGroup`). Los errores típicos tienen su explicación (retículo ↔ Golgi,
  ribosomas ↔ lisosoma, orgánulo soltado en citoplasma libre…).
- **Molécula de agua:** orden químico con `requires` (primero el átomo central, luego los
  hidrógenos, luego los enlaces), hidrógenos y enlaces intercambiables, y **zonas trampa** en línea
  recta (180°): si el estudiante pone ahí un hidrógeno, se le explica que los pares de electrones
  libres del oxígeno empujan los enlaces y por eso el agua es angular (104,5°). Sin siluetas
  (delatarían la forma): solo se ven los lugares posibles, incluidas las trampas.

### Rendimiento móvil

- `frameloop="demand"`: **0 frames por segundo en reposo** (medido); solo se dibuja mientras algo se
  mueve. Cada pieza deja de pedir frames en cuanto llega a su destino.
- `dpr={[1, 1.5]}`, sin sombras, sin post‑procesado, sin texturas descargadas (colores procedurales
  por vértice), una luz direccional pegada a la cámara + ambiente + hemisférica.
- Cada pieza es **una sola geometría y un draw call** (más su contorno solo cuando está seleccionada).
  ~19 draw calls por frame durante un arrastre y como máximo ~5 500 vértices por capa.
- Geometrías cacheadas y compartidas (pieza y silueta usan la misma), liberadas por conteo de
  referencias; materiales creados una vez y desechados al desmontar; listeners de puntero limpiados.
- Materiales translúcidos aditivos en una sola pasada (`forceSinglePass`).
- Librerías en archivos separados para cacheo: la app propia (motor + 3 rompecabezas) pesa ~34 kB gzip; three.js ~187 kB gzip
  (R3F necesita three completo).

---

## Crear un rompecabezas nuevo (sin tocar el motor)

1. Crea `src/data/miPuzzle.ts` exportando un `Puzzle3DConfig`.
2. Añádelo a `puzzleCatalog` en `src/data/index.ts`.
3. Ábrelo con `?puzzle=<id>`.

Los tres archivos de `src/data/` son ejemplos completos para copiar. Esqueleto mínimo:

```ts
import type { Puzzle3DConfig } from '../types/puzzle';

export const miPuzzleConfig: Puzzle3DConfig = {
  id: 'mi-puzzle',
  title: 'Construye…',
  description: 'Texto del catálogo.',
  icon: '🧩',
  subject: 'Ciencias',
  difficulty: 'medium',
  validation: { position: true, rotation: false, scale: false },
  model: { category: 'otro', camera: { direction: [0.3, 0.4, 1] } },
  intro: { heading: 'Construye…', lines: ['Misión en una o dos frases.'] },
  pieces: [
    {
      id: 'pieza-a',
      name: 'Pieza A',
      geometry: { type: 'sphere', radius: 0.4 },
      appearance: { color: '#a78bfa' },
      targetTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      snapThreshold: 0.3, // zona por defecto: distancia < 0,3
      info: { title: 'Pieza A', summary: 'Qué es y para qué sirve.' },
      hints: ['Primera pista.', 'Segunda pista, más concreta.'],
      feedback: { zoneDescription: 'Describe este lugar sin decir su nombre.' },
    },
    // …
  ],
  completion: { title: '¡Completo!', message: 'Lo que se ha aprendido.' },
};
```

Ideas para los siguientes contenidos:

- **Mapa del Ecuador:** `geometry: { type: 'extruded-shape', points: [...contorno de la provincia] }`,
  `interaction.dragPlane: { type: 'fixed', normal: [0, 1, 0] }` (el plano del mapa),
  zonas `sphere` en el centro de cada provincia y `rotationAxis: 'view-z'` si se quiere exigir orientación.
- **Sistema solar:** zonas `shell` = órbitas; planetas intercambiables no, cada uno su órbita.
- **Esqueleto, órganos, máquinas:** piezas `group` (varias formas fusionadas en una sola geometría).

### Referencia rápida de la configuración

| Campo | Para qué sirve |
| --- | --- |
| `difficulty` / `difficultyOverrides` | Tolerancia del snap, nº de pistas, siluetas, guías, tarjetas |
| `validation` | Qué se comprueba: posición, rotación, escala (+ tolerancias) |
| `interaction` | Plano de arrastre, giro permitido, eje y paso de giro, mezcla de la bandeja… |
| `model` | Ancla, cámara inicial (dirección, fov, zoom), silueta, decoraciones, zonas trampa (`decoys`) |
| `pieces[]` | Geometría, apariencia, objetivo, zona (+ `priority`), `snapThreshold`, info, pistas, feedback, `requires`, `matchGroup`, `shortName`, `draggable`, `lockOnPlace` |
| `intro` / `completion` | Pantalla inicial y recompensa final (decoraciones que aparecen, órbita) |
| `labels` | Cualquier texto de la interfaz (p. ej. "capas" en vez de "piezas") |

Geometrías disponibles: `sphere`, `sphere-shell` (con recorte opcional), `box`, `cylinder`, `torus`
(con `arc` opcional), `capsule`, `extruded-shape` y **`group`**: varias partes, cada una con su
posición, rotación, escala por eje y colores, fusionadas en **una sola geometría** (un draw call). Así
se construyen el núcleo con nucléolo, el aparato de Golgi, el retículo, los ribosomas o un enlace
bicolor sin tocar el motor. Para añadir un tipo nuevo: amplía la unión `GeometryConfig` y TypeScript
exigirá su constructor en `three/geometryFactory.ts`. Patrones de superficie: `solid`, `noise`,
`stripes`, `terrain`.

### Dificultad

| | easy | medium | hard |
| --- | --- | --- | --- |
| Tolerancia del snap | ×1,35 | ×1 | ×0,75 |
| Pistas por pieza | ilimitadas | 3 | 1 |
| Última pista ilumina el lugar | sí | sí | no |
| Silueta del modelo | siempre | siempre | nunca |
| Guías de zona | al arrastrar | al arrastrar | nunca |

Cualquier valor se puede ajustar por rompecabezas con `difficultyOverrides` (la molécula usa
`showGhosts: 'never'` y `showDropGuides: 'always'`).

### Modos

Implementado: **modo desafío** (`mode: 'challenge'`). El modo libre se añadiría como otro valor de
`PuzzleMode`: el estado ya admite piezas colocadas desde el inicio (`draggable: false`) y piezas que
se pueden volver a sacar (`lockOnPlace: false`).

### Métricas de aprendizaje

`<PuzzleExperience onEvent={...} />` recibe eventos `started`, `piece-placed`, `mistake` (con motivo),
`hint`, `completed` y `reset`, con métricas: intentos, errores, pistas, piezas completadas, tiempo y
desglose por pieza. Sin backend: en desarrollo se registran en consola (`App.tsx`).

### Accesibilidad

Botones ≥ 44 px, foco visible, `aria-label` en todos los controles, estado de las piezas con texto e
icono (no solo color), anuncios `aria-live` de aciertos, errores y pistas, juego completo con teclado
(Enter selecciona, flechas apuntan, Enter coloca, R gira, Escape cancela) y `prefers-reduced-motion`.

---

## Autoverificación realizada

Probado con Chrome headless (WebGL por software) a 360×800 táctil, 800×360 táctil y 1280–1440 px ratón.

Tierra:

- Rotar y hacer zoom con un dedo/pellizco; la bandeja no se mueve al orbitar. ✔
- Seleccionar (toque), arrastrar con ratón y con dedo (con desplazamiento sobre el dedo). ✔
- Error (manto en la zona de la corteza) → sacudida, regreso y mensaje educativo específico. ✔
- Soltar fuera del modelo → aviso suave sin contar error; soltar sobre la bandeja → regreso silencioso. ✔
- Snap correcto, bloqueo, tarjeta educativa que se minimiza sola. ✔
- Las 4 capas, progreso, pistas progresivas (2 de texto + iluminar el lugar), pistas agotadas. ✔
- Tocar‑para‑colocar, colocación con teclado, reinicio con confirmación (rebaraja la bandeja). ✔
- Victoria: destellos por capa, atmósfera, movimiento de cámara, órbita, resumen y métricas. ✔
- Sin scroll horizontal, sin errores de consola, `tsc` estricto sin errores, sin `any`. ✔
- 0 frames en reposo; ~19 draw calls por frame al arrastrar. ✔
- Motor ejecutando otra configuración (figuras, `matchGroup`, `requires`, lugar ocupado) sin cambios. ✔

Célula y molécula (partida completa automatizada):

- Célula: orgánulo en citoplasma libre → explicación; citoplasma como zona de fondo; retículo en el
  Golgi → explicación de la confusión; mitocondrias intercambiables; membrana en el borde; victoria
  con resumen agrupado ("Mitocondria ×2"). 0 frames en reposo, ~37 draw calls al arrastrar. ✔
- Molécula: hidrógeno antes que el oxígeno → `requires`; hidrógeno en posición lineal → explicación
  del ángulo de 104,5°; enlace antes que los átomos → `requires`; enlace en un átomo → explicación;
  victoria con pares de electrones libres y arco del ángulo. Teclado: las flechas recorren los 7
  lugares (incluidas las trampas) y se anuncian. ✔
- Catálogo, menú de opciones (reiniciar / elegir otro), botón "atrás" del navegador, bandeja de
  9 piezas en vertical (5 + 4) y en horizontal (columna lateral), la tarjeta final no tapa el modelo. ✔

## Limitaciones conocidas / siguientes pasos

- La bandeja reparte bien hasta ~10 piezas; con muchas más (p. ej. 24 provincias) necesitará
  paginación o desplazamiento.
- Geometrías importadas (glTF) y modo libre aún no implementados (la arquitectura los admite).
- Se recomienda probar en dispositivos físicos de gama media (las pruebas automáticas usan WebGL por
  software, que no refleja los FPS reales del teléfono).
