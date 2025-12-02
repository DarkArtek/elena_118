export default {
    async fetch(request, env, ctx) {
        // --- 1. Gestione CORS (Permette al frontend di parlare col backend) ---
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // O metti "http://localhost:6100" per essere più restrittivo
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Gestione Pre-flight (Il browser chiede: "Posso parlarti?")
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: corsHeaders,
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders });
        }

        try {
            const data = await request.json();

            // NOTA: Se 'gemini-2.5-pro' dà errore, usa 'gemini-1.5-pro' o 'gemini-1.5-flash'
            const MODEL_NAME = "gemini-flash-latest";

            // --- 2. System Prompt (Il "Cervello Medico") ---
            const systemInstruction = `
        Sei la Dr.ssa Elena Vitali, dottoressa di pronto soccorso digitale per soccorritori SUEM di Croce Rossa.
        
        IL TUO COMPITO PRINCIPALE:
        Oltre all'analisi clinica, devi assegnare un CODICE COLORE DI RIENTRO (Triage) basato sui dati.
        
        CRITERI TRIAGE:
        - ROSSO: Funzioni vitali compromesse (ABCD instabile), Stroke in finestra, Infarto acuto, Trauma maggiore, Shock.
        - GIALLO: Stabile ma con rischio evolutivo (es. dolore toracico dubbio, dispnea lieve/moderata, sincope, parametri border-line).
        - VERDE: Urgenza differibile, funzioni vitali stabili, dolore controllato.
        - BIANCO: Non urgente.

        LOGICA DI RAGIONAMENTO PRIORITARIA (XABCDE):
        1. X (Emorragie): Priorità assoluta.
        2. B (Respiro): SpO2 < 90%, FR < 10 o > 25 -> ALTO RISCHIO (Giallo/Rosso).
        3. C (Circolo): FC > 120 o < 50, Ipotensione -> ALTO RISCHIO.
        4. D (Neuro): FAST Positivo -> ROSSO (Stroke). AVPU non A -> Giallo/Rosso.

        OUTPUT FORMAT (HTML):
        Genera il report formattato direttamente in HTML.
        IMPORTANTE: Inizia SEMPRE con un blocco visivo per il Triage che contenga l'attributo 'data-ai-triage' per il parsing.
        
        Esempio struttura Output:
        
        <div style="background-color: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; border: 1px solid #fca5a5; margin-bottom: 15px;" data-ai-triage="Rosso">
            <b>🚑 PRIORITÀ SUGGERITA: ROSSO</b><br>
            <i>Motivo: Sospetto Stroke in finestra temporale.</i>
        </div>

        <b>ANALISI CLINICA:</b><br>
        • ...<br><br>
        <b>SBAR PER CENTRALE:</b><br>
        ...
      `;

            // --- 3. Costruzione Prompt Utente ---
            const fastStatus = [];
            if (data.fast_face) fastStatus.push("Faccia (Asimmetria)");
            if (data.fast_arm) fastStatus.push("Braccio (Caduta)");
            if (data.fast_speech) fastStatus.push("Parola (Disartria)");

            const fastText = fastStatus.length > 0
                ? `POSITIVO a: ${fastStatus.join(", ")}. Orario LKW: ${data.fast_time || 'NON SPECIFICATO'}`
                : "Negativo";

            const userPrompt = `
        SOCIO: Ciao Elena.
        Paziente: ${data.sesso || 'N/D'}, ${data.eta || 'N/D'} anni.
        
        VALUTAZIONE NEUROLOGICA:
        - AVPU: ${data.avpu || 'Non valutato'}
        - FAST (CPSS): ${fastText}
        
        PARAMETRI (B & C):
        - PA: ${data.pa_sys || '?'}/${data.pa_dia || '?'} mmHg
        - FC: ${data.fc || '?'} bpm (Toni aritmici: ${data.toni_aritmici ? 'SI' : 'NO'})
        - SpO2: ${data.spo2 || '?'}%
        - FR: ${data.fr || '?'} atti/min
        - E.O. Torace: ${data.eo_torace || 'N/V'}
        
        NOTE OPERATIVE:
        "${data.note || 'Nessuna nota.'}"
        
        TRIAGE STIMATO DAL SOCCORRITORE: ${data.triage || 'Non assegnato'}
        
        Analizza con protocollo XABCDE e definisci il tuo codice colore.
      `;

            // --- 4. Chiamata Gemini API ---
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: systemInstruction }]
                        },
                        contents: [{ parts: [{ text: userPrompt }] }],
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 4096
                        }
                    })
                }
            );

            const geminiData = await geminiResponse.json();

            // Controllo Errori API Standard
            if (geminiData.error) {
                throw new Error(`API Error: ${geminiData.error.message}`);
            }

            // Controllo Risposta Vuota o Bloccata
            if (!geminiData.candidates || geminiData.candidates.length === 0) {
                const reason = geminiData.promptFeedback?.blockReason || "Sconosciuto";
                throw new Error(`Nessun candidato generato. Motivo blocco prompt: ${reason}`);
            }

            const candidate = geminiData.candidates[0];

            // Debug approfondito sul motivo dello stop
            if (candidate.finishReason === "SAFETY") {
                const ratings = candidate.safetyRatings || [];
                const blockedRating = ratings.find(r => r.probability !== "NEGLIGIBLE" && r.probability !== "LOW");
                throw new Error(`Risposta bloccata per sicurezza. Categoria: ${blockedRating ? blockedRating.category : 'Generica'}`);
            }

            // Estrazione testo sicura con diagnostica
            let aiText = candidate.content?.parts?.[0]?.text;

            if (!aiText) {
                aiText = `⚠️ Nessun testo generato. Status: ${candidate.finishReason}.`;
            } else if (candidate.finishReason === "MAX_TOKENS") {
                aiText += "\n\n[...Risposta troncata per limite lunghezza. Sii più conciso o aumenta maxOutputTokens...]";
            }

            // --- 5. Salvataggio su Database D1 (Log Missioni) ---
            try {
                const stmt = env.DB.prepare(
                    `INSERT INTO interventi (
            sesso, eta, avpu, 
            pressione_sistolica, pressione_diastolica, 
            frequenza_cardiaca, saturazione, respiri_minuto, 
            fast_summary, eo_torace, note, suggerimento_ai
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                );

                await stmt.bind(
                    data.sesso,
                    data.eta,
                    data.avpu,
                    data.pa_sys,
                    data.pa_dia,
                    data.fc,
                    data.spo2,
                    data.fr,
                    fastText,
                    data.eo_torace,
                    data.note,
                    aiText
                ).run();
            } catch (dbError) {
                console.error("Errore salvataggio DB (non bloccante):", dbError);
            }

            // --- 6. Risposta al Frontend ---
            return new Response(JSON.stringify({ analysis: aiText }), {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                },
            });

        } catch (error) {
            return new Response(JSON.stringify({
                analysis: "⚠️ Elena Offline (Errore Backend). Procedi manualmente.\nDettaglio: " + error.message
            }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    },
};