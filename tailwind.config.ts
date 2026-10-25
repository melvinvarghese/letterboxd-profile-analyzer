import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { ink:'#101210', panel:'#171a17', line:'#292e29', moss:'#b6f36b', muted:'#929a91' }, fontFamily: { sans:['Arial','Helvetica','sans-serif'] } } }, plugins: [] };
export default config;
