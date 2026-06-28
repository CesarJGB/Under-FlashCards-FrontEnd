// FILE: frontend/src/components/FlipCard.jsx
import { useState } from 'react';

/**
 * Tarjeta con efecto de volteo 3D (flip), aislada del resto de la lógica de
 * sesión para poder debuggear el comportamiento 3D de forma independiente.
 *
 * Usa estilos inline para las propiedades críticas del efecto 3D
 * (backfaceVisibility, transformStyle, transform) en vez de clases arbitrarias
 * de Tailwind, para eliminar cualquier duda sobre si el CSS generado es exacto.
 *
 * `front` y `back` son nodos React (JSX) que se renderizan dentro de cada cara.
 * El componente no decide el contenido, solo el comportamiento de volteo.
 */
export default function FlipCard({ front, back, isFlipped, onFlip, className = '' }) {
  return (
    <div
      onClick={onFlip}
      className={`w-full h-72 cursor-pointer select-none ${className}`}
      style={{ perspective: '1000px' }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.5s',
        }}
      >
        {/* CARA FRONTAL */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden', // Safari/iOS necesita el prefijo explícito
            transform: 'rotateY(0deg)',
          }}
          className="rounded-3xl shadow-sm overflow-hidden"
        >
          {front}
        </div>

        {/* CARA TRASERA */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="rounded-3xl shadow-xl overflow-hidden"
        >
          {back}
        </div>
      </div>
    </div>
  );
}
