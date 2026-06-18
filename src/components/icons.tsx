// =====================================================================
// Iconos — trazo simple en currentColor, pensados para ir junto a
// títulos de pantalla y pestañas de navegación. Nada de un set externo
// genérico: cada uno se dibuja a mano para encajar con el grosor de
// línea y el aire "marcador de estadio" del resto de la app.
// =====================================================================

interface IconProps {
  className?: string;
}

const base = 'h-5 w-5 shrink-0';

export function IconBalon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 7.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M12 7.2V4M15.6 9.8l3-1.6M14.2 14l2 2.8M9.8 14l-2 2.8M8.4 9.8l-3-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function IconMoneda({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14.5 9c-.5-.7-1.4-1.1-2.5-1.1-1.8 0-3.2 1.4-3.2 3.6v1c0 2.2 1.4 3.6 3.2 3.6 1.1 0 2-.4 2.5-1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M7.5 10.3h4.5M7.5 13.2h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconEngranaje({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPersona({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconTrofeo({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 5.5H5.8c0 2.4 1 3.8 2.6 4M16 5.5h2.2c0 2.4-1 3.8-2.6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 13v3M9 20h6M9.5 20c0-1.6.7-2.6 2.5-2.6s2.5 1 2.5 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGrupo({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="9.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 19c.6-2.8 2.3-4.2 4.5-4.2s3.9 1.4 4.5 4.2M13.6 19c.4-2.2 1.7-3.4 3.4-3.4 1.5 0 2.7.9 3.2 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconUrna({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 10h14l-1.2 9.5H6.2L5 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 10h16M9 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13v3.5M9.5 14.5l5 1M14.5 14.5l-5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function IconMas({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
