import { createClient } from '@supabase/supabase-js';

// --- Funzione condivisa per l'aggiornamento (usata da Cron e HTTP) ---
async function updateAifaData(env) {
    console.log("🔄 Avvio procedura aggiornamento AIFA...");
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    let logs = []; // Raccogliamo i log per restituirli se chiamati via HTTP

    try {
        const log = (msg) => { console.log(msg); logs.push(msg); };

        log(`Scaricamento CSV da: ${env.AIFA_CSV_URL}`);
        const response = await fetch(env.AIFA_CSV_URL);
        if (!response.ok) throw new Error(`Fallito download CSV: ${response.status}`);

        const csvText = await response.text();
        const rows = csvText.split('\n');
        const dataRows = rows.slice(1); // Salta header

        log(`Trovate ${dataRows.length} righe. Inizio elaborazione...`);

        // Batch size ottimizzato per Cloudflare Workers (evita limiti subrequests)
        const batchSize = 4000;
        let batch = [];
        let count = 0;

        // Set per evitare duplicati AIC nello stesso ciclo
        const processedAics = new Set();

        for (const row of dataRows) {
            if (!row.trim()) continue;

            const cols = row.split(';');

            // 0: codice_aic, 3: denominazione, 6: ditta, 11: principio_attivo
            if (cols.length < 12) continue;

            const clean = (txt) => txt ? txt.replace(/"/g, '').trim() : null;
            const aic = clean(cols[0]);

            // Se l'AIC non è valido o lo abbiamo già processato, saltiamo
            if (!aic || processedAics.has(aic)) {
                continue;
            }

            processedAics.add(aic);

            batch.push({
                aic_code: aic,
                denominazione: clean(cols[3]),
                principio_attivo: clean(cols[11]),
                ditta: clean(cols[6]),
                last_updated: new Date()
            });

            if (batch.length >= batchSize) {
                const { error } = await supabase.from('farmaci').upsert(batch, { onConflict: 'aic_code' });
                if (error) console.error("Errore batch:", error.message);
                else count += batch.length;
                batch = [];
            }
        }

        if (batch.length > 0) {
            const { error } = await supabase.from('farmaci').upsert(batch, { onConflict: 'aic_code' });
            if (!error) count += batch.length;
        }

        log(`✅ Aggiornamento completato. Processati ${count} farmaci unici.`);
        return { success: true, logs };

    } catch (error) {
        console.error("❌ Errore Critico Aggiornamento:", error.message);
        return { success: false, error: error.message };
    }
}

export default {
    // --- GESTIONE CHIAMATE HTTP ---
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

        try {
            const data = await request.json();
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
            const MODEL_NAME = "gemini-2.5-pro"; // Assicurati che il modello sia corretto per la tua chiave

            // ---------------------------------------------------------
            // MODALITÀ 0: AGGIORNAMENTO FORZATO (MANUALE)
            // ---------------------------------------------------------
            if (data.type === 'force_update') {
                const result = await updateAifaData(env);
                return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 1: RICERCA FARMACI (Ibrida & Caching FIX)
            // ---------------------------------------------------------
            if (data.type === 'drug_search') {
                const query = data.query.trim();
                console.log(`🔍 Ricerca farmaco: "${query}"`);

                let dbRecord = null;

                // 1. Cerca nel DB locale (Supabase)
                const { data: farmaci, error: searchError } = await supabase
                    .from('farmaci')
                    .select('*')
                    .ilike('denominazione', `%${query}%`)
                    .limit(1);

                if (searchError) console.error("❌ Errore ricerca DB:", searchError.message);

                if (farmaci && farmaci.length > 0) {
                    dbRecord = farmaci[0];
                    console.log(`✅ Trovato in DB: ${dbRecord.denominazione} (AIC: ${dbRecord.aic_code})`);

                    // 2. Controllo Cache (Cache HIT)
                    if (dbRecord.ai_summary) {
                        console.log("🚀 Cache HIT: Restituisco dati salvati.");
                        return new Response(JSON.stringify({ analysis: dbRecord.ai_summary }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
                    } else {
                        console.log("⚠️ Cache MISS: Il record esiste ma non ha dati AI.");
                    }
                } else {
                    console.log("❌ Farmaco non trovato nel DB AIFA locale.");
                }

                // 3. Chiamata Gemini (se non in cache o record non trovato)
                const systemInstruction = `
                    Sei un assistente farmacologico esperto per il soccorso sanitario 118.
                    Analizza il farmaco richiesto: "${dbRecord ? dbRecord.denominazione : query}".
                    ${dbRecord ? `(Dati Ufficiali AIFA: Principio Attivo: ${dbRecord.principio_attivo})` : ''}
                    
                    DEVI PRODURRE UN OUTPUT HTML CON QUESTA STRUTTURA ESATTA (senza markdown):
                    1. <b>Principio Attivo & Classe:</b> [Nome], [Classe Farmacologica].
                    2. <b>A cosa serve (Sintesi):</b> [Indicazioni principali].
                    3. <b>⚠️ ALERT PER IL SOCCORRITORE:</b> [Rischi vitali, interazioni critiche].
                `;

                console.log("🤖 Chiedo a Gemini...");
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "Genera scheda." }] }],
                            systemInstruction: { parts: [{ text: systemInstruction }] }
                        })
                    }
                );

                const geminiJson = await geminiResponse.json();
                const aiText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna informazione disponibile.";

                // 4. Salvataggio Cache (Se abbiamo un record DB su cui agganciarci)
                if (dbRecord) {
                    console.log(`💾 Tento salvataggio cache per AIC: ${dbRecord.aic_code}...`);

                    const { error: updateError } = await supabase
                        .from('farmaci')
                        .update({
                            ai_summary: aiText,
                            ai_updated_at: new Date().toISOString() // FIX: Formato data corretto
                        })
                        .eq('aic_code', dbRecord.aic_code)
                        .select();

                    if (updateError) {
                        console.error("❌ Errore salvataggio cache:", updateError.message);
                    } else {
                        console.log("✅ Cache salvata con successo!");
                    }
                } else {
                    console.warn("⚠️ Impossibile salvare cache: Nessun record DB associato (Ricerca generica).");
                }

                return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 2: ANALISI CLINICA (Standard)
            // ---------------------------------------------------------
            if (data.type === 'analysis') {
                const systemInstruction = `
                    Sei la Dr.ssa Elena Vitali, dottoressa digitale per il SUEM 118.
                    COMPITO: Analisi clinica e assegnazione CODICE COLORE DI RIENTRO (Triage).
                    OUTPUT FORMAT (HTML): <div style="..." data-ai-triage="[COLORE]">...</div>
                `;

                const userPrompt = `Paziente: ${data.sesso} ${data.eta}aa. Note: "${data.note}". Triage: ${data.triage || 'N/D'}. Analizza.`;

                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            systemInstruction: { parts: [{ text: systemInstruction }] },
                            contents: [{ parts: [{ text: userPrompt }] }]
                        })
                    }
                );

                const geminiJson = await geminiResponse.json();
                const aiText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "Errore AI.";

                // Salvataggio storico su D1 (se configurato) o log
                try {
                    if (env.DB) {
                        await env.DB.prepare(`INSERT INTO interventi (sesso, eta, note, suggerimento_ai) VALUES (?, ?, ?, ?)`).bind(data.sesso, data.eta, data.note, aiText).run();
                    }
                } catch (e) { console.error("Errore salvataggio D1:", e); }

                return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // Fallback
            return new Response(JSON.stringify({ error: "Tipo richiesta sconosciuto" }), { status: 400, headers: corsHeaders });

        } catch (error) {
            console.error("❌ Errore Server:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    },

    // --- GESTIONE CRON JOB (Automatico) ---
    async scheduled(event, env, ctx) {
        await updateAifaData(env);
    }
};