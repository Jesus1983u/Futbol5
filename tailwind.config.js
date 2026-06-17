/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "partido nocturno": césped oscuro de fondo, nunca negro puro,
        // con dos acentos cada uno con un trabajo claro: ámbar (foco/acción
        // principal, como un foco de iluminación) y verde-azulado (éxito /
        // estados confirmados, como el brillo frío de la noche).
        pitch: {
          deep: '#0E2A1E',
          mid: '#163D2A',
          line: '#234A35',
        },
        chalk: '#F5F3EA',
        floodlight: {
          DEFAULT: '#E8A33D',
          dim: '#B97F2C',
        },
        confirmed: '#4FA98C',
        muted: '#6B8278',
        danger: '#D9684B',
      },
      fontFamily: {
        display: ['"Oswald"', 'sans-serif'],
        body: ['"Source Sans 3"', '"Source Sans Pro"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
