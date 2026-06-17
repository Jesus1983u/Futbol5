interface AvatarProps {
  nombre: string;
  apellidos?: string | null;
  tamaño?: 'sm' | 'md';
}

export function Avatar({ nombre, apellidos, tamaño = 'sm' }: AvatarProps) {
  const iniciales =
    `${nombre.charAt(0)}${apellidos?.charAt(0) ?? ''}`.toUpperCase() || '?';
  const clases =
    tamaño === 'md' ? 'h-12 w-12 text-lg' : 'h-9 w-9 text-sm';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-pitch-line font-display text-floodlight ${clases}`}
    >
      {iniciales}
    </div>
  );
}
