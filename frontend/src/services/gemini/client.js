import { buildUserPrompt } from './prompts';

// 🚨 STEP FONDAMENTALE 🚨
// Sostituisci la stringa qui sotto con l'URL che hai ottenuto dal deploy su Cloudflare
// Esempio: "https://elena-backend.mario-rossi.workers.dev"
const WORKER_URL = "https://elena-backend.ahdcreative.workers.dev";

/**
 * Gestisce la chiamata all'AI o il fallback offline
 */
export const analyzePatient = async (formData) => {
    try {
        // 1. Controllo di sicurezza: Se l'URL è ancora quello finto, non provo nemmeno a chiamarlo
        if (WORKER_URL.includes("tuo-worker")) {
            console.warn("URL Worker non configurato nel codice. Attivo modalità DEMO.");
            throw new Error("Worker URL non configurato");
        }

        // 2. Chiamata Reale a Cloudflare + Gemini
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Se il backend risponde con un errore gestito (es. API key non valida)
        if (data.error) throw new Error(data.error);

        return data.analysis;

    } catch (error) {
        console.warn("⚠️ Fallback Offline attivato:", error);
        // Se c'è un errore (niente internet o URL sbagliato), usiamo il simulatore
        return generateOfflineSimulation(formData);
    }
};

/**
 * SIMULATORE LOCALE (OFFLINE MODE)
 * Entra in funzione se non c'è internet o se l'URL non è configurato.
 */
const generateOfflineSimulation = (data) => {
    const isFastPositive = data.fast.face || data.fast.arm || data.fast.speech;
    const fc = parseInt(data.fc);
    const isTachy = fc > 100;
    const isBrady = fc < 60;
    const isHypoxic = data.spo2 < 90;

    let warnings = [];
    if (isFastPositive) warnings.push("**FAST POSITIVO** (Code Stroke)");
    if (isHypoxic) warnings.push(`**IPOSSIA** (SpO2 ${data.spo2}%)`);
    if (data.pa_sys < 90 && data.pa_sys > 0) warnings.push("**IPOTENSIONE** (Shock?)");

    let ecgAdvice = "";
    if (isTachy || isBrady) {
        ecgAdvice = `\n⚠️ **Protocollo Aritmie:** FC ${fc}. ${data.toni_aritmici ? 'Toni Aritmici.' : ''} Esegui ECG (Gi-Ro-Ne-Ve).`;
    }

    const urgency = warnings.length > 0 ? "CRITICA" : "stabile";

    return `**ELENA (Offline Mode):**
Ciao. Situazione ${urgency}.
${warnings.map(w => `- ${w}`).join('\n')}

**Analisi Rapida:**
* **X:** Verificare emorragie (Note: "${data.note || 'N.D.'}").
* **B:** ${isHypoxic ? `SpO2 Critica. E.O.: ${data.eo_torace}` : 'Respiro compensato.'}
* **C:** PA ${data.pa_sys}/${data.pa_dia}. ${ecgAdvice}
* **D:** AVPU ${data.avpu}. ${isFastPositive ? `LKW: ${data.fast.time}` : 'No deficit focali acuti.'}

**SBAR Bozza:**
* **S:** ${data.sesso} ${data.eta}aa. ${urgency}.
* **B:** ${data.note}
* **A:** Parametri vitali ${urgency}.
* **R:** Valutazione medica / Ospedalizzazione.`;
};