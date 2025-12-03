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

        const batchSize = 100;
        let batch = [];
        let count = 0;

        for (const row of dataRows) {
            if (!row.trim()) continue;

            const cols = row.split(';');

            // 0: codice_aic, 3: denominazione, 6: ditta, 11: principio_attivo
            if (cols.length < 12) continue;

            const clean = (txt) => txt ? txt.replace(/"/g, '').trim() : null;

            batch.push({
                aic_code: clean(cols[0]),
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

        log(`✅ Aggiornamento completato. Processati ${count} farmaci.`);
        return { success: true, logs };

    } catch (error) {
        console.error("❌ Errore Critico:", error.message);
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
            const MODEL_NAME = "gemini-2.5-pro";

            // ---------------------------------------------------------
            // MODALITÀ 0: AGGIORNAMENTO FORZATO (MANUALE)
            // ---------------------------------------------------------
            if (data.type === 'force_update') {
                const result = await updateAifaData(env);
                return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 1: RICERCA FARMACI (Ibrida)
            // ---------------------------------------------------------
            if (data.type === 'drug_search') {
                const query = data.query.trim();
                let dbRecord = null;

                const { data: farmaci } = await supabase
                    .from('farmaci')
                    .select('*')
                    .ilike('denominazione', `%${query}%`)
                    .limit(1);

                if (farmaci && farmaci.length > 0) {
                    dbRecord = farmaci[0];
                    if (dbRecord.ai_summary) {
                        return new Response(JSON.stringify({ analysis: dbRecord.ai_summary }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
                    }
                }

                // Chiamata Gemini (se non in cache)
                const systemInstruction = `
                    Sei un assistente farmacologico esperto per il soccorso sanitario 118.
                    Analizza il farmaco richiesto: "${dbRecord ? dbRecord.denominazione : query}".
                    ${dbRecord ? `(Dati Ufficiali AIFA: Principio Attivo: ${dbRecord.principio_attivo})` : ''}
                    
                    DEVI PRODURRE UN OUTPUT HTML CON QUESTA STRUTTURA ESATTA:
                    1. <b>Principio Attivo & Classe:</b> [Nome], [Classe Farmacologica].
                    2. <b>A cosa serve (Sintesi):</b> [Indicazioni principali].
                    3. <b>⚠️ ALERT PER IL SOCCORRITORE:</b> [Rischi vitali, interazioni critiche].
                `;

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

                if (dbRecord) {
                    await supabase.from('farmaci').update({ ai_summary: aiText, ai_updated_at: new Date() }).eq('aic_code', dbRecord.aic_code);
                }

                return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 2: ANALISI CLINICA (Standard)
            // ---------------------------------------------------------
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

            try {
                await env.DB.prepare(`INSERT INTO interventi (sesso, eta, note, suggerimento_ai) VALUES (?, ?, ?, ?)`).bind(data.sesso, data.eta, data.note, aiText).run();
            } catch (e) { console.error("Errore salvataggio D1:", e); }

            return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    },

    // --- GESTIONE CRON JOB (Automatico) ---
    async scheduled(event, env, ctx) {
        await updateAifaData(env);
    }
};