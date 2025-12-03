import { createClient } from '@supabase/supabase-js';

// --- Funzione condivisa per l'aggiornamento (usata da Cron e HTTP) ---
async function updateAifaData(env) {
    console.log("🔄 Avvio procedura aggiornamento AIFA...");
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    let logs = [];

    try {
        const log = (msg) => { console.log(msg); logs.push(msg); };

        log(`Scaricamento CSV da: ${env.AIFA_CSV_URL}`);
        const response = await fetch(env.AIFA_CSV_URL);
        if (!response.ok) throw new Error(`Fallito download CSV: ${response.status}`);

        const csvText = await response.text();
        const rows = csvText.split('\n');
        const dataRows = rows.slice(1);

        log(`Trovate ${dataRows.length} righe. Inizio elaborazione...`);

        const batchSize = 4000;
        let batch = [];
        let count = 0;
        const processedAics = new Set();

        for (const row of dataRows) {
            if (!row.trim()) continue;

            const cols = row.split(';');
            if (cols.length < 12) continue;

            const clean = (txt) => txt ? txt.replace(/"/g, '').trim() : null;
            const aic = clean(cols[0]);

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
        console.error("❌ Errore Critico:", error.message);
        return { success: false, error: error.message };
    }
}

export default {
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
                let aiText = "";

                // 1. Cerca nel DB AIFA
                const { data: farmaci } = await supabase
                    .from('farmaci')
                    .select('*')
                    .ilike('denominazione', `%${query}%`)
                    .limit(1);

                if (farmaci && farmaci.length > 0) {
                    dbRecord = farmaci[0];
                }

                // 2. Ottieni testo AI (da Cache o Nuova Generazione)
                if (dbRecord && dbRecord.ai_summary) {
                    aiText = dbRecord.ai_summary;
                    console.log("✅ Cache HIT per:", dbRecord.denominazione);
                } else {
                    console.log("⚠️ Cache MISS. Chiedo a Gemini...");

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
                    aiText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna informazione disponibile.";

                    // Salva in Cache se abbiamo un record DB (CON DEBUG ERRORI)
                    if (dbRecord) {
                        const { error: updateError } = await supabase
                            .from('farmaci')
                            .update({
                                ai_summary: aiText,
                                ai_updated_at: new Date()
                            })
                            .eq('aic_code', dbRecord.aic_code);

                        if (updateError) {
                            console.error("❌ ERRORE SCRITTURA CACHE:", updateError);
                        } else {
                            console.log("✅ Cache salvata con successo per:", dbRecord.denominazione);
                        }
                    }
                }

                // 3. Costruzione Risposta Finale (Unione Dati Ufficiali + AI)
                let finalOutput = aiText;

                if (dbRecord) {
                    const aifaBlock = `
                        <div class="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm shadow-sm">
                            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 text-[#23408e] font-bold uppercase tracking-wider text-xs">
                                <i class="fa-solid fa-certificate"></i> Dati Ufficiali AIFA
                            </div>
                            <div class="space-y-1 text-slate-600">
                                <div><span class="font-semibold text-slate-800">Denominazione:</span> ${dbRecord.denominazione}</div>
                                <div><span class="font-semibold text-slate-800">Principio Attivo:</span> ${dbRecord.principio_attivo}</div>
                                <div class="flex gap-4">
                                    <div><span class="font-semibold text-slate-800">AIC:</span> ${dbRecord.aic_code}</div>
                                    <div class="truncate"><span class="font-semibold text-slate-800">Ditta:</span> ${dbRecord.ditta}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    finalOutput = aifaBlock + aiText;
                }

                return new Response(JSON.stringify({ analysis: finalOutput }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 2: ANALISI CLINICA (Standard)
            // ---------------------------------------------------------
            // ... (Resto del codice invariato)
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

    async scheduled(event, env, ctx) {
        await updateAifaData(env);
    }
};