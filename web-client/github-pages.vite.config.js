import { defineConfig } from 'vite'

// Version of the config for deploying into GitHub pages.
export default defineConfig({
	base: 'wind-flower-game/live',
	plugins: [],
	server: { host: '0.0.0.0', port: 3000 },
	clearScreen: false,
})
