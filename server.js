const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Wiktionary: definition + part of speech for an Italian word
app.get('/api/define/:word', async (req, res) => {
  const word = encodeURIComponent(req.params.word.toLowerCase());
  try {
    const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`, {
      headers: { 'User-Agent': 'Parlami/1.0 (language learning app)' }
    });
    if (!r.ok) return res.json({ error: 'not found' });
    const data = await r.json();
    const itSections = data.it || [];
    const result = itSections.map(s => ({
      partOfSpeech: s.partOfSpeech,
      definitions: (s.definitions || []).slice(0, 3).map(d => ({
        definition: d.definition.replace(/<[^>]+>/g, ''),
        examples: (d.examples || []).slice(0, 2).map(e => e.replace(/<[^>]+>/g, ''))
      }))
    }));
    res.json({ word: req.params.word, definitions: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Tatoeba: real example sentences in Italian with English translations
app.get('/api/sentences', async (req, res) => {
  const query = encodeURIComponent(req.query.q || '');
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);
  try {
    const r = await fetch(
      `https://tatoeba.org/api_v0/search?from=ita&to=eng&query=${query}&limit=${limit}`,
      { headers: { 'User-Agent': 'Parlami/1.0' } }
    );
    if (!r.ok) return res.json({ sentences: [] });
    const data = await r.json();
    const sentences = (data.results || []).map(s => ({
      italian: s.text,
      english: (s.translations && s.translations[0] && s.translations[0][0])
        ? s.translations[0][0].text
        : null
    })).filter(s => s.english);
    res.json({ sentences });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── MyMemory: translate an Italian phrase to English (or reverse)
app.get('/api/translate', async (req, res) => {
  const text = encodeURIComponent(req.query.text || '');
  const from = req.query.from || 'it';
  const to = req.query.to || 'en';
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${text}&langpair=${from}|${to}`,
      { headers: { 'User-Agent': 'Parlami/1.0' } }
    );
    const data = await r.json();
    res.json({
      original: req.query.text,
      translation: data.responseData?.translatedText || null,
      matches: (data.matches || []).slice(0, 5).map(m => ({
        italian: from === 'it' ? m.segment : m.translation,
        english: from === 'it' ? m.translation : m.segment,
        quality: m.quality
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Wiktionary category vocab: fetch a topic's Italian word list
app.get('/api/vocab/:topic', async (req, res) => {
  const topic = req.params.topic;

  // Map topics to curated word lists + fetch definitions for each
  const topicWords = {
    greetings: ['ciao','buongiorno','buonasera','buonanotte','arrivederci','prego','grazie','scusa','salve','benvenuto'],
    food: ['pizza','pasta','pane','vino','acqua','caffè','gelato','formaggio','carne','pesce','verdura','frutta','ristorante','menu','conto'],
    numbers: ['uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','venti','trenta','cento','mille'],
    travel: ['aeroporto','stazione','albergo','biglietto','treno','autobus','taxi','passaporto','valigia','mappa','destra','sinistra','dritto'],
    family: ['madre','padre','fratello','sorella','figlio','figlia','nonno','nonna','zio','zia','cugino','marito','moglie'],
    colors: ['rosso','blu','verde','giallo','nero','bianco','arancione','viola','rosa','grigio','marrone','azzurro'],
    weather: ['sole','pioggia','neve','vento','nuvola','temporale','caldo','freddo','temperatura','cielo','nebbia'],
    animals: ['cane','gatto','uccello','pesce','cavallo','mucca','maiale','pecora','leone','tigre','elefante','farfalla'],
    shopping: ['negozio','prezzo','comprare','vendere','mercato','sconto','taglia','colore','cassa','carta','contante','ricevuta'],
    body: ['testa','occhio','naso','bocca','orecchio','mano','piede','braccio','gamba','cuore','stomaco','schiena'],
    emotions: ['felice','triste','arrabbiato','spaventato','sorpreso','annoiato','stanco','innamorato','ansioso','calmo','orgoglioso'],
    verbs: ['essere','avere','fare','andare','venire','parlare','mangiare','bere','dormire','lavorare','studiare','leggere','scrivere'],
    nationalities: ['italiano','francese','inglese','tedesco','spagnolo','americano','cinese','giapponese','russo','brasiliano','australiano','messicano','argentino','portoghese','greco'],
    house: ['casa','stanza','cucina','bagno','camera','soggiorno','porta','finestra','tetto','scale','giardino','garage','corridoio','cantina','terrazza'],
    clothing: ['camicia','pantaloni','gonna','vestito','scarpe','cappotto','giacca','maglione','cintura','cappello','calzini','guanti','sciarpa','cravatta','abito'],
    seasons: ['primavera','estate','autunno','inverno','stagione','marzo','giugno','settembre','dicembre','fresco','umido','secco','nevoso','soleggiato','temperatura'],
    classroom: ['scuola','università','classe','lezione','compito','voto','professore','studente','libro','quaderno','matita','penna','lavagna','zaino','biblioteca'],
    drinks: ['acqua','vino','birra','succo','latte','tè','caffè','aranciata','limonata','aperitivo','prosecco','grappa','amaro','cocktail','bicchiere'],
    cafe: ['bar','caffè','cornetto','cappuccino','espresso','brioche','tavolo','cameriere','colazione','aperitivo','tramezzino','crostata','bancone','scontrino','ordinare'],
    fruits: ['mela','banana','arancia','fragola','uva','pera','pesca','ciliegia','limone','ananas','mango','kiwi','cocomero','melone','lampone'],
    vegetables: ['pomodoro','carota','patata','insalata','cipolla','aglio','peperone','melanzana','zucchine','piselli','spinaci','broccoli','cavolfiore','sedano','funghi'],
    cooking: ['cucinare','ricetta','ingrediente','forno','padella','bollire','friggere','tagliare','mescolare','sapore','salare','condire','preparare','cuocere','servire'],
    months: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','mese','anno','data'],
    sports: ['calcio','tennis','nuoto','ciclismo','pallacanestro','pallavolo','sci','atletica','boxe','yoga','corsa','palestra','squadra','allenamento','campionato'],
    hobbies: ['lettura','musica','viaggi','fotografia','pittura','giardinaggio','cinema','danza','teatro','scacchi','escursionismo','artigianato','scrittura','cucito','collezionismo'],
    personality: ['simpatico','gentile','timido','coraggioso','onesto','generoso','paziente','curioso','ambizioso','creativo','determinato','intelligente','sensibile','allegro','serio'],
    transport: ['autobus','metropolitana','tram','bicicletta','motocicletta','macchina','traghetto','elicottero','nave','scooter','patente','multa','parcheggio','traffico','semaforo'],
    hotel: ['albergo','camera','prenotazione','reception','chiave','colazione','piscina','servizio','piano','ascensore','balcone','vista','doppia','singola','suite'],
    nature: ['montagna','foresta','lago','mare','spiaggia','fiume','collina','prato','albero','fiore','roccia','cascata','vulcano','deserto','parco'],
    career: ['lavoro','ufficio','collega','capo','stipendio','contratto','riunione','progetto','scadenza','carriera','promozione','azienda','impresa','cliente','fattura'],
    technology: ['computer','telefono','internet','applicazione','software','schermo','tastiera','wifi','bluetooth','email','password','sito','download','aggiornamento','digitale'],
    media: ['televisione','radio','giornale','rivista','podcast','social','notizie','articolo','intervista','pubblicità','film','serie','documentario','canale','streaming'],
    art: ['museo','quadro','scultura','pittore','mostra','galleria','acquerello','olio','affresco','capolavoro','stile','epoca','movimento','critica','collezione'],
    music: ['canzone','cantante','chitarra','pianoforte','concerto','album','melodia','ritmo','orchestra','opera','jazz','rock','classica','festival','violino'],
    history: ['storia','guerra','re','regina','impero','rivoluzione','secolo','antico','medievale','rinascimento','cultura','civiltà','evento','documento','monumento'],
    geography: ['Italia','città','regione','monte','lago','fiume','mare','isola','pianura','collina','nord','sud','confine','capitale','territorio'],
    environment: ['natura','foresta','oceano','clima','inquinamento','riciclaggio','energia','solare','sostenibile','biodiversità','specie','ecosistema','pianeta','riscaldamento','verde'],
    politics: ['governo','parlamento','elezione','presidente','ministro','legge','partito','voto','democrazia','costituzione','senato','regione','comune','sindaco','cittadino'],
    education: ['scuola','università','diploma','laurea','esame','borsa','corso','facoltà','ricerca','tesi','dottorato','voto','professore','studente','istruzione'],
    healthcare: ['ospedale','medico','infermiere','medicina','cura','diagnosi','pronto','soccorso','farmacia','prescrizione','paziente','salute','malattia','operazione','ambulanza'],
    finance: ['banca','soldi','conto','carta','prestito','mutuo','investimento','borsa','risparmio','spesa','tasse','reddito','fattura','euro','pagamento'],
    idioms: ['in bocca al lupo','cavoli riscaldati','non tutte le ciambelle','fare il passo','acqua in bocca','prendere due piccioni','avere il prosciutto','a tutto gas','in quattro e quattr otto','bella lì'],
    celebrations: ['natale','pasqua','capodanno','compleanno','anniversario','festa','carnevale','ferragosto','matrimonio','battesimo','regalo','torta','brindisi','auguri','celebrazione'],
    // Unit 1 missing
    alphabet: ['lettera','vocale','consonante','alfabeto','sillaba','accento','doppio','suono','pronuncia','spelling','maiuscola','minuscola','parola','frase','tono'],
    phrases: ['prego','grazie','scusa','permesso','aiuto','non capisco','per favore','come stai','bene','male','così così','certo','va bene','allora','piacere'],
    // Unit 2 missing
    days: ['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica','settimana','oggi','ieri','domani','giorno','mattina','pomeriggio','sera'],
    time: ['ora','minuto','secondo','mattina','pomeriggio','sera','notte','mezzanotte','mezzogiorno','presto','tardi','adesso','dopo','prima','quanto'],
    // Unit 3 missing
    descriptions: ['alto','basso','grasso','magro','bello','brutto','giovane','vecchio','lungo','corto','grande','piccolo','forte','debole','veloce'],
    jobs: ['medico','avvocato','insegnante','ingegnere','architetto','cuoco','giornalista','attore','musicista','poliziotto','pompiere','pilota','infermiere','meccanico','commerciante'],
    // Unit 4 missing
    places: ['museo','farmacia','banca','chiesa','piazza','mercato','biblioteca','ospedale','scuola','ristorante','posta','hotel','cinema','teatro','stadio'],
    directions: ['destra','sinistra','dritto','dietro','davanti','sopra','sotto','vicino','lontano','dentro','fuori','attraverso','girare','seguire','semaforo'],
    // Unit 5 missing
    present_tense: ['parlo','parli','parla','parliamo','parlate','parlano','mangio','bevi','dorme','andiamo','venite','fanno','stare','sapere','capire'],
    past_tense: ['ho mangiato','sono andato','hai detto','è venuto','abbiamo fatto','sono stati','participio','ausiliare','passato','ieri','scorso','già','mai','quando','ancora'],
    future: ['mangerò','andrò','sarò','avrò','farò','dirò','verrò','potrò','dovrò','vorrò','parleremo','finirete','domani','prossimo','futuro'],
    modal_verbs: ['volere','potere','dovere','voglio','puoi','deve','vogliamo','potete','devono','vorrei','potrei','dovrei','sapere','riuscire','osare'],
    pronouns: ['io','tu','lui','lei','noi','voi','loro','mi','ti','ci','vi','lo','la','li','le','me','te','se','questo','quello'],
    prepositions: ['di','a','da','in','con','su','per','tra','fra','al','del','nel','sul','dal','alla','della','nella','sulla','dalle','alle'],
    adjectives: ['bello','brutto','grande','piccolo','buono','cattivo','nuovo','vecchio','caro','economico','facile','difficile','interessante','noioso','importante'],
    negation: ['non','niente','nessuno','mai','nemmeno','né','senza','neppure','affatto','mica','ancora','più','neanche','giammai','nulla'],
    questions: ['chi','cosa','dove','quando','come','perché','quale','quanto','quanti','quante','come mai','da dove','a che ora','che cosa','quale'],
    // Unit 6 missing
    law: ['legge','diritto','tribunale','giudice','avvocato','accusato','condanna','sentenza','reato','pena','giustizia','costituzione','articolo','processo','ricorso'],
    science: ['scienza','esperimento','teoria','ipotesi','laboratorio','ricerca','risultato','chimica','fisica','biologia','matematica','formula','elemento','cellula','evoluzione'],
    housing: ['affitto','proprietario','inquilino','contratto','agenzia','condominio','appartamento','villa','monolocale','spese','deposito','mutuo','rinnovo','disdetta','agenzia'],
    food_culture: ['antipasto','primo','secondo','dolce','digestivo','aperitivo','sagra','cucina','ricetta','tradizione','tipico','regionale','biologico','artigianale','denominazione'],
    // Unit 7 missing
    cinema: ['film','regista','attore','attrice','sceneggiatura','regia','montaggio','colonna sonora','festival','documentario','sequel','schermo','proiezione','personaggio','trama'],
    literature: ['romanzo','poesia','racconto','autore','scrittore','editore','capitolo','personaggio','trama','narratore','genere','classico','contemporaneo','critica','premio'],
    customs: ['tradizione','usanza','galateo','bacio','abbraccio','regalo','ospite','cortesia','rispetto','formale','informale','saluto','cerimonia','festa','rito'],
    architecture: ['duomo','basilica','palazzo','piazza','colonna','arco','cupola','torre','castello','anfiteatro','fontana','facciata','stile','restauro','patrimonio'],
    fashion: ['moda','stilista','sfilata','abito','collezione','tendenza','accessorio','firmato','tessuto','stagione','boutique','taglia','lusso','vintage','capo'],
    sports_culture: ['tifoso','squadra','campionato','scudetto','derby','stadio','arbitro','fallo','gol','pareggio','vittoria','sconfitta','classifica','coppa','allenatore'],
    regional: ['Lombardia','Toscana','Sicilia','Campania','Lazio','Veneto','Piemonte','Sardegna','Puglia','Calabria','nord','sud','centro','regione','dialetto'],
    // Unit 8 missing
    subjunctive: ['congiuntivo','che','voglia','venga','sia','abbia','faccia','vada','possa','debba','benché','sebbene','affinché','quantunque','speriamo'],
    conditional: ['condizionale','vorrei','potrei','sarei','avrei','farei','andrei','verrei','direi','darei','starei','mangerei','parleresti','verrebbe','useremmo'],
    formal_writing: ['egregio','spettabile','distinti','saluti','cordialmente','gentile','oggetto','allegato','riferimento','convocazione','circolare','raccomandata','firma','intestazione','protocollo'],
    debate: ['secondo me','a mio parere','tuttavia','d\'altra parte','inoltre','invece','infatti','quindi','dunque','nonostante','pertanto','affermare','contestare','argomentare','concludere'],
    philosophy: ['filosofia','etica','morale','verità','coscienza','esistenza','libertà','giustizia','bellezza','conoscenza','ragione','logica','dialettica','metafisica','epistemologia'],
    proverbs: ['proverbio','detto','saggezza','tradizione','popolare','antico','significato','metafora','consiglio','esperienza','vita','mondo','uomo','tempo','fortuna'],
    advanced_verbs: ['riflessivo','reciproco','causativo','gerundio','participio','imperativo','congiuntivo','condizionale','perifrastica','stare per','andare a','venire da','fare fare','lasciare','permettere'],
    business: ['riunione','trattativa','proposta','contratto','offerta','fattura','preventivo','budget','mercato','cliente','fornitore','accordo','strategia','obiettivo','investimento'],
    dialects: ['veneziano','napoletano','siciliano','romanesco','milanese','genovese','fiorentino','barese','piemontese','calabrese','accento','variante','parlata','espressione','inflessione'],
  };

  // Exact match first (normalise spaces↔underscores), then fuzzy
  const t = topic.toLowerCase();
  const tNorm = t.replace(/ /g, '_');
  const key = Object.keys(topicWords).find(k => k === t || k === tNorm) ||
    Object.keys(topicWords).find(k => t.includes(k) || k.includes(t) || tNorm.includes(k) || k.includes(tNorm)) || null;

  const words = key ? topicWords[key] : null;

  if (!words) {
    // For unknown topics, try Wiktionary category search
    try {
      const r = await fetch(
        `https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Italian_${encodeURIComponent(topic)}&cmlimit=20&format=json`,
        { headers: { 'User-Agent': 'Parlami/1.0' } }
      );
      const data = await r.json();
      const members = (data.query?.categorymembers || []).map(m => m.title.toLowerCase());
      if (members.length > 0) return res.json({ topic, words: members.slice(0, 15), source: 'wiktionary_category' });
    } catch (_) {}
    return res.json({ topic, words: [], error: 'Topic not found' });
  }

  // Fetch a sample of definitions to enrich the response
  const sample = words.slice(0, 8);
  const definitions = {};
  await Promise.all(sample.map(async w => {
    try {
      const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${w}`, {
        headers: { 'User-Agent': 'Parlami/1.0' }
      });
      if (!r.ok) return;
      const data = await r.json();
      const it = (data.it || [])[0];
      if (it?.definitions?.[0]) {
        definitions[w] = it.definitions[0].definition.replace(/<[^>]+>/g, '');
      }
    } catch (_) {}
  }));

  res.json({ topic, words, definitions, source: 'curated+wiktionary' });
});

// Per-level exercise type sequences and sentence complexity bounds.
// Types: mc_it_to_en, mc_en_to_it, match_pairs, fill_blank, translate, listening, speaking_repeat, speaking_translate
const LEVEL_CONFIG = {
  a1: { minWords: 3, maxWords: 6,  types: ['mc_it_to_en','match_pairs','mc_en_to_it','mc_it_to_en','fill_blank','match_pairs','mc_en_to_it'] },
  a2: { minWords: 3, maxWords: 8,  types: ['mc_it_to_en','mc_en_to_it','match_pairs','fill_blank','mc_it_to_en','translate','mc_en_to_it','fill_blank'] },
  b1: { minWords: 4, maxWords: 10, types: ['mc_it_to_en','fill_blank','translate','mc_en_to_it','listening','speaking_repeat','fill_blank','mc_it_to_en'] },
  b2: { minWords: 5, maxWords: 12, types: ['fill_blank','translate','listening','speaking_repeat','mc_it_to_en','fill_blank','speaking_translate','translate'] },
  c1: { minWords: 6, maxWords: 15, types: ['fill_blank','translate','listening','speaking_translate','fill_blank','speaking_repeat','translate','listening'] },
  c2: { minWords: 6, maxWords: 20, types: ['fill_blank','translate','listening','speaking_translate','fill_blank','speaking_translate','translate','listening'] },
};

// ── Build a full lesson: combines vocab + sentences + translations
app.post('/api/lesson', async (req, res) => {
  const { topic, userContext } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });

  try {
    // 1. Get vocab list
    const vocabRes = await fetch(`http://localhost:${PORT}/api/vocab/${encodeURIComponent(topic)}`);
    const vocabData = await vocabRes.json();
    const words = vocabData.words || [];

    if (words.length === 0) return res.json({ topic, exercises: [], error: 'No vocabulary found for this topic' });

    // 2. Get example sentences from Tatoeba
    const sentRes = await fetch(`http://localhost:${PORT}/api/sentences?q=${encodeURIComponent(topic)}&limit=15`);
    const sentData = await sentRes.json();
    const sentences = sentData.sentences || [];

    // 3. Get translations for the first few words
    const translationMap = {};
    const toTranslate = words.slice(0, 12);
    await Promise.all(toTranslate.map(async w => {
      try {
        const r = await fetch(`http://localhost:${PORT}/api/translate?text=${encodeURIComponent(w)}&from=it&to=en`);
        const d = await r.json();
        if (d.translation) translationMap[w] = d.translation.toLowerCase();
      } catch (_) {}
    }));

    // 4. Build exercises from real data, adapted to the user's level
    const exercises = buildExercises(topic, words, sentences, translationMap, vocabData.definitions || {}, userContext || {});
    res.json({ topic, exercises, wordCount: words.length, sentenceCount: sentences.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function buildExercises(topic, words, sentences, translations, definitions, userContext) {
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; };

  const level = (userContext && userContext.cefrLevel) || 'a1';
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.a1;
  const struggling = new Set((userContext && userContext.strugglingWords) || []);
  const known = new Set((userContext && userContext.knownWords) || []);

  // Prioritise: struggling words first, then unseen words, then already-known
  const prioritized = [
    ...words.filter(w => struggling.has(w)),
    ...words.filter(w => !struggling.has(w) && !known.has(w)),
    ...words.filter(w => known.has(w) && !struggling.has(w))
  ];
  const orderedWords = prioritized.length ? prioritized : words;

  // Build translation pairs in priority order
  const pairs = orderedWords.filter(w => translations[w]).map(w => [w, translations[w]]);
  const fallbackWords = shuffle(words);

  // Filter sentences to the level's complexity range; widen if too few
  const sentPool = (() => {
    const tight = sentences.filter(s => {
      const wc = s.italian.split(' ').length;
      return wc >= cfg.minWords && wc <= cfg.maxWords;
    });
    if (tight.length >= 3) return tight;
    return sentences.filter(s => {
      const wc = s.italian.split(' ').length;
      return wc >= Math.max(3, cfg.minWords - 1) && wc <= cfg.maxWords + 3;
    });
  })();

  // Sentence iterator — each call returns the next unused sentence
  const usedSentIdx = new Set();
  function nextSent() {
    for (let i = 0; i < sentPool.length; i++) {
      if (!usedSentIdx.has(i)) { usedSentIdx.add(i); return sentPool[i]; }
    }
    return null;
  }

  const exercises = [];
  let pairCursor = 0;

  function nextPair() {
    if (!pairs.length) return null;
    const p = pairs[pairCursor % pairs.length];
    pairCursor++;
    return p;
  }

  // When translations are sparse, pad with word-list distractors for MC exercises
  function mcDistractorsIT(exclude) {
    return shuffle(fallbackWords.filter(w => w !== exclude)).slice(0, 3);
  }

  for (const type of cfg.types) {
    if (exercises.length >= 10) break;

    if (type === 'mc_it_to_en') {
      if (pairs.length >= 2) {
        const target = nextPair();
        const wrongFromPairs = pairs.filter(p => p[0] !== target[0]).map(p => p[1]);
        // Pad with generic distractors if needed
        const padded = [...wrongFromPairs, 'a word', 'an object', 'an action', 'a place'].filter((v,i,a)=>a.indexOf(v)===i);
        const wrong = shuffle(padded).slice(0, 3);
        if (wrong.length === 3) {
          exercises.push({
            type: 'multiple_choice',
            prompt: `What does "${target[0]}" mean?`,
            options: shuffle([target[1], ...wrong]),
            answer: target[1],
            hint: definitions[target[0]] ? definitions[target[0]].slice(0, 80) : null
          });
        }
      } else if (words.length >= 4) {
        // No translations — make a listening/recognition exercise instead
        const word = orderedWords[exercises.length % orderedWords.length];
        const def = definitions[word];
        exercises.push({
          type: 'listening',
          prompt: 'Listen and type what you hear:',
          audio: word,
          answer: word.toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: def ? `Meaning: "${def.slice(0, 60)}"` : `A ${topic}-related word`
        });
      }

    } else if (type === 'mc_en_to_it') {
      if (pairs.length >= 2) {
        const target = nextPair();
        const wrongIT = shuffle(pairs.filter(p => p[0] !== target[0]).map(p => p[0]));
        // Pad with word-list distractors if needed
        const extra = mcDistractorsIT(target[0]).filter(w => !wrongIT.includes(w));
        const wrong = [...wrongIT, ...extra].slice(0, 3);
        if (wrong.length === 3) {
          exercises.push({
            type: 'multiple_choice',
            prompt: `How do you say "${target[1]}" in Italian?`,
            options: shuffle([target[0], ...wrong]),
            answer: target[0],
            hint: definitions[target[0]] ? definitions[target[0]].slice(0, 80) : null
          });
        }
      } else if (words.length >= 4) {
        const word = orderedWords[exercises.length % orderedWords.length];
        const wrong3 = mcDistractorsIT(word);
        exercises.push({
          type: 'multiple_choice',
          prompt: `Which word belongs to the topic "${topic}"?`,
          options: shuffle([word, ...wrong3]),
          answer: word,
          hint: definitions[word] ? definitions[word].slice(0, 80) : null
        });
      }

    } else if (type === 'match_pairs') {
      if (pairs.length >= 4) {
        exercises.push({
          type: 'match_pairs',
          prompt: `Match the Italian ${topic} words to their meanings`,
          pairs: shuffle(pairs).slice(0, 4)
        });
      } else if (pairs.length >= 3) {
        exercises.push({
          type: 'match_pairs',
          prompt: `Match the Italian ${topic} words to their meanings`,
          pairs: pairs.slice(0, 3)
        });
      }

    } else if (type === 'fill_blank') {
      const sent = nextSent();
      if (sent) {
        const wds = sent.italian.split(' ');
        const blankIdx = wds.findIndex((w, i) =>
          i > 0 && i < wds.length - 1 && w.replace(/[^a-zàèéìòù]/gi, '').length > 3
        );
        if (blankIdx > -1) {
          const blank = wds[blankIdx].replace(/[.,!?;:]/g, '');
          const display = [...wds];
          display[blankIdx] = '___';
          exercises.push({
            type: 'fill_blank',
            prompt: display.join(' '),
            hint: `English: "${sent.english}"`,
            answer: blank.toLowerCase(),
            placeholder: 'Type the missing word...'
          });
        } else {
          // Sentence found but no good blank word — use it as listening instead
          exercises.push({
            type: 'listening',
            prompt: 'Listen and type what you hear:',
            audio: sent.italian,
            answer: sent.italian.toLowerCase().replace(/[.,!?;:]/g, ''),
            hint: `Meaning: "${sent.english}"`
          });
        }
      } else if (orderedWords.length > 0) {
        // No sentences — blank a word from vocabulary
        const word = orderedWords[exercises.length % orderedWords.length];
        const def = definitions[word] || `a ${topic} word`;
        exercises.push({
          type: 'fill_blank',
          prompt: `___ (${topic})`,
          hint: `Meaning: "${def.slice(0, 60)}"`,
          answer: word.toLowerCase(),
          placeholder: 'Type the Italian word...'
        });
      }

    } else if (type === 'translate') {
      const sent = nextSent();
      if (sent) {
        const answerWords = sent.italian.toLowerCase().replace(/[.,!?;:]/g, '').split(' ').filter(Boolean);
        const distractors = shuffle(fallbackWords.filter(w => !answerWords.includes(w))).slice(0, 3);
        exercises.push({
          type: 'translate',
          prompt: 'Translate to Italian:',
          english: sent.english,
          answer: sent.italian.toLowerCase().replace(/[.,!?;:]/g, ''),
          words: shuffle([...answerWords, ...distractors])
        });
      } else if (pairs.length >= 1) {
        // No sentences — use a vocab pair as a word-bank translate
        const target = nextPair();
        exercises.push({
          type: 'fill_blank',
          prompt: `How do you write "${target[1]}" in Italian?`,
          hint: definitions[target[0]] ? definitions[target[0]].slice(0, 80) : null,
          answer: target[0].toLowerCase(),
          placeholder: 'Type the Italian word...'
        });
      }

    } else if (type === 'listening') {
      const sent = nextSent();
      if (sent) {
        exercises.push({
          type: 'listening',
          prompt: 'Listen and type what you hear:',
          audio: sent.italian,
          answer: sent.italian.toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: `Meaning: "${sent.english}"`
        });
      } else if (orderedWords.length > 0) {
        // No sentences — listen to individual vocabulary word
        const word = orderedWords[exercises.length % orderedWords.length];
        exercises.push({
          type: 'listening',
          prompt: 'Listen and type what you hear:',
          audio: word,
          answer: word.toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: definitions[word] ? `Meaning: "${definitions[word].slice(0, 60)}"` : null
        });
      }

    } else if (type === 'speaking_repeat') {
      // Find a short unused sentence
      let speakSent = null;
      for (let i = 0; i < sentPool.length; i++) {
        if (!usedSentIdx.has(i) && sentPool[i].italian.split(' ').length <= Math.min(cfg.maxWords, 7)) {
          usedSentIdx.add(i);
          speakSent = sentPool[i];
          break;
        }
      }
      if (!speakSent && sentPool.length > 0) speakSent = sentPool[0];
      if (speakSent) {
        exercises.push({
          type: 'speaking',
          subtype: 'repeat',
          prompt: 'Say this phrase out loud:',
          audio: speakSent.italian,
          answer: speakSent.italian.toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: `Meaning: "${speakSent.english}"`
        });
      } else if (orderedWords.length > 0) {
        // No sentences — speak a vocabulary word
        const word = orderedWords[exercises.length % orderedWords.length];
        exercises.push({
          type: 'speaking',
          subtype: 'repeat',
          prompt: 'Say this word out loud:',
          audio: word,
          answer: word.toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: definitions[word] ? `Meaning: "${definitions[word].slice(0, 60)}"` : null
        });
      }

    } else if (type === 'speaking_translate') {
      const target = nextPair();
      if (target) {
        exercises.push({
          type: 'speaking',
          subtype: 'translate',
          prompt: 'Say this in Italian:',
          english: target[1],
          audio: target[0],
          answer: target[0].toLowerCase().replace(/[.,!?;:]/g, ''),
          hint: `Say: "${target[0]}"`
        });
      }
    }
  }

  return exercises.slice(0, 10);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Parlami server running on http://localhost:${PORT}`));
