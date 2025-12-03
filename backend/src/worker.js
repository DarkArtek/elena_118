export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders });
        }

        try {
            const data = await request.json();
            const MODEL_NAME = "gemini-flash-latest"; // O "gemini-1.5-flash"

            // --- SELEZIONE MODALITÀ ---
            let systemInstruction = "";
            let userPrompt = "";

            if (data.type === 'drug_search') {
                // --- MODALITÀ FARMACI ---
                systemInstruction = `
                    Sei una assistente farmacologica per soccorritori 118.
                    Il tuo compito è analizzare il nome di un farmaco (commerciale o principio attivo) fornito dall'utente.
                    
                    DEVI FORNIRE IN FORMATO HTML PULITO:
                    1. <b>Principio Attivo & Classe:</b> (es. Bisoprololo, Beta-bloccante).
                    2. <b>A cosa serve (Sintesi):</b> (es. Ipertensione, Scompenso).
                    3. <b>⚠️ ALERT PER IL SOCCORRITORE:</b> (Cosa implica per noi? es. "Rischio bradicardia", "Paziente anticoagulato - rischio emorragico alto", "Immunosoppresso").
                    
                    Sii concisa. Non dare dosaggi se non richiesti. Focus sulle implicazioni operative in emergenza.
                `;
                userPrompt = `Farmaco o Terapia indicata: "${data.query}". Analizza.`;

            } else {
                // --- MODALITÀ INTERVENTO (Standard) ---
                systemInstruction = `
                    Sei la Dr.ssa Elena Vitali, dottoressa digitale per soccorso extra-ospedaliero.
                    
                    LOGICA DI RAGIONAMENTO (XABCDE):
                    1. X (Emorragie): Priorità assoluta.
                    2. B (Respiro): SpO2 < 90%, FR alterata.
                    3. C (Circolo): Aritmie, Ipotensione.
                    4. D (Neuro): FAST, AVPU.
                    
                    TRIAGE COLORE: Assegna un codice (Rosso/Giallo/Verde/Bianco) in base alla gravità.
                    
                    OUTPUT HTML:
                    Inizia con un blocco <div data-ai-triage="..."> per il codice colore.
                    Poi fornisci Analisi Clinica e SBAR.
                `;

                // Costruzione prompt standard...
                const fastText = (data.fast_face || data.fast_arm || data.fast_speech)
                    ? `POSITIVO. LKW: ${data.fast_time}` : "Negativo";

                userPrompt = `
                    Paziente: ${data.sesso} ${data.eta} anni.
                    AVPU: ${data.avpu}. FAST: ${fastText}.
                    Parametri: PA ${data.pa_sys}/${data.pa_dia}, FC ${data.fc}, SpO2 ${data.spo2}, FR ${data.fr}.
                    Note: "${data.note}". Triage Utente: ${data.triage}.
                    Analizza XABCDE e Triage.
                `;
            }

            // --- CHIAMATA GEMINI ---
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        contents: [{ parts: [{ text: userPrompt }] }],
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ]
                    })
                }
            );

            const geminiData = await geminiResponse.json();

            if (geminiData.error) throw new Error(geminiData.error.message);

            const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta.";

            // --- SALVATAGGIO DB (Solo per interventi clinici, non per ricerche farmaci) ---
            if (data.type !== 'drug_search') {
                try {
                    await env.DB.prepare(
                        `INSERT INTO interventi (sesso, eta, avpu, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, saturazione, respiri_minuto, note, suggerimento_ai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(data.sesso, data.eta, data.avpu, data.pa_sys, data.pa_dia, data.fc, data.spo2, data.fr, data.note, aiText).run();
                } catch (dbError) { console.error("DB Error:", dbError); }
            }

            return new Response(JSON.stringify({ analysis: aiText }), {
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });

        } catch (error) {
            return new Response(JSON.stringify({
                analysis: "⚠️ Errore Elena: " + error.message
            }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    },
};