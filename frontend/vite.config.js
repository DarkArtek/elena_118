import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate', // Aggiorna l'app automaticamente appena c'è una nuova versione
            includeAssets: ['icon.svg'], // Assicura che l'icona sia nella cache offline
            manifest: {
                name: 'Elena - Digital Partner 118',
                short_name: 'Elena 118',
                description: 'Decision Support System per soccorritori CRI',
                theme_color: '#23408e', // Blu medicale (corrisponde all'header)
                background_color: '#f1f5f9', // Slate-100 (corrisponde allo sfondo)
                display: 'standalone', // Rimuove la barra degli indirizzi del browser (sembra nativa)
                orientation: 'portrait', // Blocca in verticale (utile per l'uso con una mano)
                icons: [
                    {
                        src: 'icon.svg',
                        sizes: 'any', // L'SVG scala all'infinito
                        type: 'image/svg+xml',
                        purpose: 'any maskable' // Adattabile alle icone tonde di Android
                    }
                ]
            },
            // Configurazione per il Service Worker (cache offline)
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}']
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})