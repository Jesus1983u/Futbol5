// =====================================================================
// telefono.ts — conversión teléfono → email "falso", compartida entre
// el frontend (src/) y el Worker (worker/index.ts).
// =====================================================================
// Por qué existe esto: Supabase exige configurar un proveedor de SMS
// de verdad (Twilio o similar) solo para poder activar el inicio de
// sesión por teléfono, aunque nuestra app nunca mande ningún SMS — se
// entra con contraseña, no con código. Es una exigencia del panel de
// Supabase, no algo que se pueda evitar desde el código.
//
// La solución: en vez de usar el campo "phone" nativo de Supabase
// Auth, cada persona se autentica con email + contraseña (que SÍ
// funciona sin ningún proveedor adicional, ya lo usa Jesús desde el
// principio), pero ese email no es uno real — se construye a partir
// del teléfono, p.ej. "612345678" → "612345678@futbol5.local". La
// persona nunca ve ni escribe ese email: solo escribe su teléfono en
// el login, y por debajo se convierte sin que se note.
//
// CRÍTICO: esta misma función se usa en dos sitios — al crear la
// cuenta (worker/index.ts) y al iniciar sesión (AuthContext.tsx). Si
// alguna vez se cambia esta lógica, hay que cambiarla en los dos
// sitios a la vez (o, mejor, solo aquí, ya que ambos importan este
// mismo archivo) — si se desincronizan, nadie podría volver a entrar
// con cuentas ya creadas.
// =====================================================================

const DOMINIO_EMAIL_FALSO = 'futbol5.local';

/** Deja solo los dígitos de un teléfono, y si vienen con el prefijo
 *  de España (34) delante de un número de 9 cifras, lo quita — así
 *  da igual que alguien escriba "612345678", "+34612345678" o
 *  "34 612 345 678": las tres acaban en el mismo email falso. */
export function normalizarDigitosTelefono(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, '');
  if (soloDigitos.length > 9 && soloDigitos.startsWith('34')) {
    return soloDigitos.slice(2);
  }
  return soloDigitos;
}

/** Construye el email falso a partir de un teléfono, ya normalizado.
 *  Determinista: el mismo teléfono siempre da el mismo email, tanto
 *  al crear la cuenta como al iniciar sesión después. */
export function telefonoAEmailFalso(telefono: string): string {
  return `${normalizarDigitosTelefono(telefono)}@${DOMINIO_EMAIL_FALSO}`;
}
