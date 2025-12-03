// ⚠️ IMPORTANTE: Sostituisci questa stringa con il TUO URL reale di Cloudflare Worker
// Lo ottieni dopo aver fatto 'npx wrangler deploy' nella cartella backend
const WORKER_URL = "https://elena-backend.ahdcreative.workers.dev";

/**
 * Richiede l'analisi clinica di un paziente (XABCDE + Triage)
 * @param {Object} formData - I dati del form (età, sesso, parametri, note, ecc.)
 */
export const analyzePatient = async (formData) => {
    // Aggiungiamo il tipo 'analysis' per dire al worker cosa fare
    return _callWorker({ ...formData, type: 'analysis' });
};

/**
 * Cerca informazioni su un farmaco (Prontuario AI)
 * @param {String} drugName - Il nome del farmaco o principio attivo
 */
export const searchDrug = async (drugName) => {
    // Aggiungiamo il tipo 'drug_search' e la query
    return _callWorker({ query: drugName, type: 'drug_search' });
};

/**
 * Funzione generica privata per chiamare il Worker
 */
const _callWorker = async (payload) => {
    try {
        // Controllo di sicurezza per evitare chiamate a URL finti
        if (WORKER_URL.includes("tuo-nome")) {
            console.warn("URL Worker non configurato. Controlla client.js");
            throw new Error("URL Backend non configurato correttamente.");
        }

        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        // Se il backend restituisce un errore gestito (es. Safety Filter)
        if (data.error) throw new Error(data.error);

        return data.analysis;

    } catch (error) {
        console.error("Errore API:", error);
        // Ritorniamo un messaggio user-friendly invece di rompere l'app
        return "⚠️ Servizio momentaneamente non disponibile. Controlla la connessione o l'URL del backend.";
    }
};