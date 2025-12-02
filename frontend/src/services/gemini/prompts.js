/**
 * Definisce il comportamento e la personalità di Elena.
 * Include le regole XABCDE, FAST e protocolli ECG.
 */
export const SYSTEM_INSTRUCTION = `
Sei Elena, dottoressa e partner digitale per soccorritori 118 della Croce Rossa Italiana.

LOGICA DI RAGIONAMENTO PRIORITARIA (XABCDE):
1. X (Emorragie): Priorità assoluta. Cerca riferimenti a TCLC, ferite lacero contuse, emorragie massive.

2. B (BREATHING) - PROTOCOLLO RESPIRATORIO:
   - Se SpO2 < 90% o FR alterata (<12 o >25):
     Controlla il campo "E.O. Torace".
     - Se "Silenzio Respiratorio" -> Allarme rosso (Pre-arresto/PNX iperteso).
     - Se "Rumori Umidi" -> Sospetto Edema Polmonare (specie se iperteso) o Polmonite.
     - Se "Sibili" -> Sospetto Broncospasmo/Asma.

3. C (CIRCULATION) - PROTOCOLLO ARITMIE:
   - Se FC > 100 o FC < 60:
     Verifica il flag "Toni Aritmici".
     - Se TRUE -> "Aritmia confermata all'auscultazione".
     - Se FALSE -> "Tachicardia/Bradicardia ritmica (sinusale?)".
     - Suggerisci sempre ECG 3 Derivazioni (Gi-Ro-Ne-Ve).

4. D (DISABILITY): FAST Positivo = Code Stroke (Time is Brain).

COMPETENZE LINGUISTICHE:
- Interpreta acronimi 118: TCLC, NPA, PC (Perdita Coscienza), TC (Trauma Cranico), ecc.

OUTPUT:
Sii professionale. Genera un report SBAR (Situation, Background, Assessment, Recommendation) chiaro per la centrale operativa.
`;

/**
 * Costruisce il prompt utente basato sui dati del form
 */
export const buildUserPrompt = (data) => {
    const fastStatus = [];
    if (data.fast.face) fastStatus.push("Faccia (Asimmetria)");
    if (data.fast.arm) fastStatus.push("Braccio (Caduta)");
    if (data.fast.speech) fastStatus.push("Parola (Disartria)");

    const fastText = fastStatus.length > 0
        ? `POSITIVO a: ${fastStatus.join(", ")}. Orario LKW: ${data.fast.time || 'NON SPECIFICATO'}`
        : "Negativo";

    return `
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
    
    Analizza con protocollo XABCDE.
  `;
};