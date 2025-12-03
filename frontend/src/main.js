import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Importiamo gli stili globali (Tailwind)
import './style.css'
import App from './App.vue'
import router from './router'
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome'
import {library} from "@fortawesome/fontawesome-svg-core";

// Registrazione Icone
import {
    faBookMedical,
    faHeartbeat,
    faHeartPulse,
    faFileWaveform,
    faNotesMedical,
    faStaffAesculapius,
    faStaffSnake,
    faHeartCircleBolt,
    faHeartCircleCheck,
    faHeartCircleExclamation,
    faUserDoctor,
    faPowerOff
} from "@fortawesome/free-solid-svg-icons";
// Aggiungiamo le icone alla libreria
library.add(
    faBookMedical,
    faHeartbeat,
    faHeartPulse,
    faHeartCircleExclamation,
    faHeartCircleCheck,
    faFileWaveform,
    faNotesMedical,
    faStaffAesculapius,
    faStaffSnake,
    faHeartCircleBolt,
    faUserDoctor,
    faPowerOff
)

// Creazione dell'istanza Vue
const app = createApp(App)

// Registriamo il componente FontAwesome globalmente
app.component('font-awesome-icon', FontAwesomeIcon)

// Inizializzazione Store (Pinia)
const pinia = createPinia()

// Registrazione dei plugin
app.use(pinia)
app.use(router)

// Montaggio dell'app nel div #app presente in index.html
app.mount('#app')