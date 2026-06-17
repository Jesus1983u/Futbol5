// =====================================================================
// ScoreboardCodeInput — el código de 6 dígitos como tablero electrónico.
// =====================================================================
// Elemento de firma de la pantalla de login: cada dígito es una casilla
// que se ilumina en ámbar (color del foco de un campo nocturno) al
// recibir el foco, imitando un marcador de estadio. Soporta pegar el
// código completo de golpe (lo normal si llega copiado del email).
// =====================================================================

import { useRef } from 'react';

interface ScoreboardCodeInputProps {
  longitud?: number;
  valor: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}

export function ScoreboardCodeInput({
  longitud = 6,
  valor,
  onChange,
  disabled = false,
}: ScoreboardCodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digitos = Array.from({ length: longitud }, (_, i) => valor[i] ?? '');

  function escribirEn(indice: number, caracter: string) {
    const soloDigito = caracter.replace(/\D/g, '');
    const nuevos = [...digitos];
    nuevos[indice] = soloDigito.slice(-1) ?? '';
    onChange(nuevos.join(''));
    if (soloDigito && indice < longitud - 1) {
      refs.current[indice + 1]?.focus();
    }
  }

  function manejarTeclaAbajo(indice: number, evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Backspace' && !digitos[indice] && indice > 0) {
      refs.current[indice - 1]?.focus();
    }
  }

  function manejarPegado(evento: React.ClipboardEvent<HTMLInputElement>) {
    const texto = evento.clipboardData.getData('text').replace(/\D/g, '').slice(0, longitud);
    if (!texto) return;
    evento.preventDefault();
    onChange(texto);
    const indiceFinal = Math.min(texto.length, longitud - 1);
    refs.current[indiceFinal]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Código de verificación">
      {digitos.map((digito, indice) => (
        <input
          key={indice}
          ref={(el) => {
            refs.current[indice] = el;
          }}
          value={digito}
          disabled={disabled}
          onChange={(e) => escribirEn(indice, e.target.value)}
          onKeyDown={(e) => manejarTeclaAbajo(indice, e)}
          onPaste={manejarPegado}
          inputMode="numeric"
          autoComplete={indice === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Dígito ${indice + 1} de ${longitud}`}
          className="h-14 w-11 rounded-md border-2 border-pitch-line bg-pitch-mid text-center font-display text-2xl font-semibold text-floodlight caret-floodlight transition-colors focus:border-floodlight disabled:opacity-50"
        />
      ))}
    </div>
  );
}
