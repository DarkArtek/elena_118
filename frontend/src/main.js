import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Importiamo gli stili globali (Tailwind)
import './style.css'
import App from './App.vue'
import router from './router'

// Creazione dell'istanza Vue
const app = createApp(App)

// Inizializzazione Store (Pinia)
const pinia = createPinia()

// Registrazione dei plugin
app.use(pinia)
app.use(router)

// Montaggio dell'app nel div #app presente in index.html
app.mount('#app')