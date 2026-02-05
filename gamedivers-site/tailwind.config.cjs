/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#070a12',
        panel: '#0f1626',
        panelSoft: '#141c2f',
        neon: '#48f2ff',
        ember: '#ff7a00',
        mist: '#9aa4b2',
      },
      boxShadow: {
        glow: '0 0 30px rgba(72, 242, 255, 0.25)',
        ember: '0 10px 30px rgba(255, 122, 0, 0.25)',
      },
      fontFamily: {
        display: ['"Orbitron"', 'system-ui', 'sans-serif'],
        body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gridlines':
          'linear-gradient(rgba(72,242,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(72,242,255,0.08) 1px, transparent 1px)',
        'radial-glow': 'radial-gradient(circle at 20% 10%, rgba(72,242,255,0.18), transparent 55%)',
        'ember-glow': 'radial-gradient(circle at 80% 20%, rgba(255,122,0,0.25), transparent 55%)',
      },
    },
  },
  plugins: [],
}
