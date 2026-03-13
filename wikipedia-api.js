// ============================================
// 📚 Wikipedia API – Pflanzeninfos abrufen (kostenlos, kein Key nötig)
// ============================================

const WikipediaAPI = {
    BASE_URL: 'https://de.wikipedia.org/api/rest_v1',
    SEARCH_URL: 'https://de.wikipedia.org/w/api.php',

    // Pflanze suchen und besten Treffer zurückgeben
    async search(query) {
        const url = `${this.SEARCH_URL}?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        // data = [query, [titles], [descriptions], [urls]]
        if (!data[1] || data[1].length === 0) return [];
        return data[1].map((title, i) => ({
            title,
            description: data[2]?.[i] || '',
            url: data[3]?.[i] || ''
        }));
    },

    // Detailierte Infos zu einem Wikipedia-Artikel holen
    async getPlantInfo(title) {
        // 1. Zusammenfassung holen
        const summaryUrl = `${this.BASE_URL}/page/summary/${encodeURIComponent(title)}?redirect=true`;
        const summaryRes = await fetch(summaryUrl);
        if (!summaryRes.ok) throw new Error('Artikel nicht gefunden');
        const summary = await summaryRes.json();

        // 2. Strukturierte Daten (Infobox) über MediaWiki API holen
        const infoUrl = `${this.SEARCH_URL}?action=query&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=content&rvsection=0&format=json&origin=*`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();

        // Infobox parsen
        let rawContent = '';
        const pages = infoData?.query?.pages;
        if (pages) {
            const page = Object.values(pages)[0];
            rawContent = page?.revisions?.[0]?.['*'] || '';
        }

        // Taxonomie-Infos extrahieren
        const taxonomy = this.parseTaxonomy(rawContent);

        // Bild von Summary
        const imageUrl = summary.thumbnail?.source || summary.originalimage?.source || null;

        return {
            title: summary.title,
            description: summary.extract || '',
            description_short: summary.description || '',
            image_url: imageUrl,
            wiki_url: summary.content_urls?.desktop?.page || '',
            taxonomy,
            raw_extract: summary.extract || ''
        };
    },

    // Taxonomische Infos aus Wikitext extrahieren
    parseTaxonomy(wikitext) {
        const extract = (key) => {
            // Suche nach | Key = Wert in der Taxobox
            const patterns = [
                new RegExp(`\\|\\s*${key}\\s*=\\s*(.+?)\\s*(?:\\n|\\|)`, 'i'),
                new RegExp(`${key}[:\\s]+([^\\n|]+)`, 'i')
            ];
            for (const re of patterns) {
                const match = wikitext.match(re);
                if (match) {
                    // Wiki-Markup bereinigen
                    return match[1]
                        .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
                        .replace(/'''?/g, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/\{\{[^}]+\}\}/g, '')
                        .trim();
                }
            }
            return '';
        };

        return {
            familie: extract('Familie') || extract('familia'),
            gattung: extract('Gattung') || extract('genus'),
            ordnung: extract('Ordnung') || extract('ordo'),
            wissenschaftlich: extract('Name') || extract('Taxon_WissName') || extract('Taxon2_WissName'),
        };
    },

    // Pflanzenkategorie erraten basierend auf Wikipedia-Text
    guessCategory(text) {
        const lower = text.toLowerCase();
        if (/gemüse|nutzpflanze|kulturpflanze|speisepflanze|nahrungspflanze/.test(lower)) return 'gemuese';
        if (/obstbaum|obst|frucht|beere|kern|steinobst/.test(lower)) return 'obst';
        if (/kraut|küchenkraut|gewürz|heilpflanze|heilkraut|arznei/.test(lower)) return 'kraeuter';
        if (/zierpflanze|blüte|blume|schnittblume/.test(lower)) return 'blumen';
        if (/staude|staudenpflanze|rhizom/.test(lower)) return 'stauden';
        if (/strauch|gehölz|hecke|busch|baum/.test(lower)) return 'straeucher';
        return 'sonstige';
    },

    // Bio-Pflegeplan-Template basierend auf Kategorie generieren
    generateBioCarePlan(category) {
        const plans = {
            gemuese: {
                jan: ['Saatgut sichten, samenfeste Sorten bevorzugen', 'Anbauplan skizzieren (Fruchtfolge beachten!)'],
                feb: ['Frühbeet vorbereiten', 'Kompost auf Beete ausbringen'],
                mar: ['Vorziehen auf Fensterbank', 'Boden mit Grabegabel lockern (nicht umgraben!)'],
                apr: ['Jungpflanzen abhärten', 'Mulchschicht ausbringen', 'Mischkultur-Partner planen'],
                mai: ['Nach Eisheiligen (15.5.) auspflanzen', 'Brennnesseljauche ansetzen', 'Mulchen mit Grasschnitt'],
                jun: ['Regelmäßig hacken statt spritzen', 'Nützlinge fördern (Blühstreifen)', 'Mit Regenwasser gießen'],
                jul: ['Brennnesseljauche als Dünger alle 2 Wochen', 'Morgens gießen', 'Beikräuter als Mulch liegen lassen'],
                aug: ['Ernten! Saatgut von besten Pflanzen gewinnen', 'Gründüngung auf freie Beete säen'],
                sep: ['Letzte Ernte', 'Gründüngung säen (Phacelia, Senf)', 'Kompost ausbringen'],
                okt: ['Beete mit Laub/Stroh mulchen', 'Nicht umgraben – Bodenlebewesen schonen'],
                nov: ['Beetränder mit Reisig abdecken', 'Kompost umsetzen'],
                dez: ['Saatgutkatalog studieren', 'Anbauplan für nächstes Jahr']
            },
            obst: {
                jan: ['Obstbaumschnitt bei frostfreiem Wetter', 'Leimringe kontrollieren'],
                feb: ['Obstbaumschnitt fortsetzen', 'Baumscheiben mit Kompost mulchen'],
                mar: ['Kalkanstrich erneuern (Frostschutz)', 'Ohrwurm-Quartiere aufhängen (gegen Blattläuse)'],
                apr: ['Blütenansatz beobachten', 'Bei Spätfrost: Vlies über Blüten'],
                mai: ['Baumscheibe mulchen', 'Raupen von Hand ablesen'],
                jun: ['Junifruchtfall abwarten', 'Befallene Früchte entfernen'],
                jul: ['Sommerschnitt bei Kirsche', 'Fallobst aufsammeln (Schädlingskreislauf unterbrechen)'],
                aug: ['Ernte! Nur reife Früchte pflücken', 'Fruchtmumien entfernen'],
                sep: ['Letzte Ernte', 'Leimringe anbringen'],
                okt: ['Baumscheibe mit Kompost mulchen', 'Totholz als Nützlingshotel stapeln'],
                nov: ['Stammschutz anbringen', 'Laub unter Bäumen liegen lassen (Humusbildung)'],
                dez: ['Winterschnitt planen', 'Nistkästen reinigen']
            },
            kraeuter: {
                jan: [],
                feb: ['Mehrjährige Kräuter auf Fensterbank vorziehen'],
                mar: ['Schnittlauch teilen', 'Frühbeet für Kräuter vorbereiten'],
                apr: ['Kräuterspirale anlegen/pflegen', 'Aussaat mediterrane Kräuter'],
                mai: ['Auspflanzen nach Eisheiligen', 'Kräuter als Mischkultur-Partner nutzen'],
                jun: ['Regelmäßig ernten fördert Wachstum', 'Blüten für Tee trocknen'],
                jul: ['Kräuter vormittags ernten (höchster Ölgehalt)', 'Kräuteressig ansetzen'],
                aug: ['Kräuter trocknen/einfrieren für Winter', 'Samen sammeln'],
                sep: ['Letzte große Ernte vor dem Frost', 'Kräuteröle herstellen'],
                okt: ['Mehrjährige Kräuter mit Reisig abdecken', 'Rosmarin ggf. reinholen'],
                nov: ['Kräuter auf Fensterbank kultivieren'],
                dez: []
            },
            blumen: {
                jan: [],
                feb: ['Sommerblumen vorziehen'],
                mar: ['Stauden teilen', 'Rosen schneiden'],
                apr: ['Dahlienknollen vortreiben', 'Wildblumenwiese anlegen'],
                mai: ['Sommerblumen auspflanzen', 'Mulchen zwischen Stauden'],
                jun: ['Verblühtes ausputzen', 'Blühpflanzen für Insekten stehen lassen'],
                jul: ['Regelmäßig gießen', 'Samen für nächstes Jahr sammeln'],
                aug: ['Herbstblüher pflanzen', 'Stecklinge nehmen'],
                sep: ['Frühblüherzwiebeln setzen', 'Samen ernten und trocknen'],
                okt: ['Dahlienknollen ausgraben', 'Rosen anhäufeln'],
                nov: ['Winterschutz anbringen', 'Laub als natürliche Abdeckung'],
                dez: []
            },
            stauden: {
                jan: [],
                feb: ['Gräser zurückschneiden'],
                mar: ['Stauden teilen und verpflanzen', 'Kompost einarbeiten'],
                apr: ['Mulchschicht erneuern', 'Schneckenbarrieren anlegen (Sägemehl, Asche)'],
                mai: ['Staudenbeete mulchen', 'Wildkraut-Konkurrenz im Zaum halten'],
                jun: ['Hohe Stauden anbinden', 'Verblühtes für Nachblüte schneiden'],
                jul: ['Bei Trockenheit durchdringend gießen', 'Bodendecker als lebender Mulch'],
                aug: ['Herbststauden pflanzen'],
                sep: ['Stauden teilen', 'Samenstände stehen lassen (Winternahrung für Vögel!)'],
                okt: ['Nicht zurückschneiden! Stängel bieten Insekten Winterquartier'],
                nov: ['Frostempfindliche Stauden mit Laub abdecken'],
                dez: []
            },
            straeucher: {
                jan: ['Formschnitt an frostfreien Tagen'],
                feb: ['Auslichtungsschnitt', 'Kompost um Sträucher verteilen'],
                mar: ['Letzte Schnittmaßnahmen vor der Brutzeit!', 'Totholz als Benjeshecke aufschichten'],
                apr: ['Mulchen mit Rindenmulch oder Holzhäcksel'],
                mai: ['Wildtriebe entfernen'],
                jun: ['Leichter Formschnitt nach der Blüte'],
                jul: ['Bei Trockenheit wässern', 'Stecklinge nehmen'],
                aug: [],
                sep: ['Herbstschnitt'],
                okt: ['Neupflanzung (Wurzelware)', 'Laubkompost sammeln'],
                nov: ['Winterschutz für empfindliche Sorten'],
                dez: []
            },
            sonstige: {
                jan: [], feb: [], mar: ['Standort vorbereiten'],
                apr: ['Boden lockern, Kompost einarbeiten'],
                mai: ['Auspflanzen, mulchen'],
                jun: ['Regelmäßig gießen'], jul: ['Pflegen und beobachten'],
                aug: ['Pflegen'], sep: ['Herbstvorbereitung'],
                okt: ['Winterschutz prüfen'], nov: [], dez: []
            }
        };
        return plans[category] || plans.sonstige;
    },

    // Bio-Tipps basierend auf Kategorie
    getBioTips(category) {
        const tips = {
            gemuese: {
                mischkultur: 'Nutze Mischkultur: Tomaten + Basilikum, Möhren + Zwiebeln, Bohnen + Bohnenkraut',
                duengung: 'Brennnesseljauche (1:10 verdünnt) alle 2 Wochen als natürlicher Dünger',
                schaedlinge: 'Nützlinge fördern: Marienkäfer gegen Blattläuse, Schlupfwespen gegen Raupen',
                mulch: 'Mulchen mit Grasschnitt oder Stroh hält Feuchtigkeit und unterdrückt Beikraut'
            },
            obst: {
                mischkultur: 'Unterpflanzung mit Kapuzinerkresse oder Knoblauch schützt vor Schädlingen',
                duengung: 'Baumscheibe mit reifem Kompost mulchen – beste natürliche Düngung',
                schaedlinge: 'Ohrwurm-Tontöpfe in Bäume hängen – Ohrwürmer fressen Blattläuse',
                mulch: 'Baumscheibe nie nackt lassen – Mulch oder Unterpflanzung schützt den Boden'
            },
            kraeuter: {
                mischkultur: 'Kräuter sind perfekte Mischkultur-Partner – Basilikum neben Tomaten, Dill neben Gurken',
                duengung: 'Kräuter brauchen wenig Dünger – zu viel mindert das Aroma! Nur leichter Kompost',
                schaedlinge: 'Stark duftende Kräuter vertreiben Schädlinge natürlich',
                mulch: 'Mediterrane Kräuter mögen Kies-Mulch (wärmt, drainiert)'
            },
            blumen: {
                mischkultur: 'Ringelblumen und Tagetes im Gemüsebeet halten Nematoden fern',
                duengung: 'Kompost im Frühjahr – fertig! Wildblumen brauchen mageren Boden',
                schaedlinge: 'Vielfalt ist der beste Schutz – mische Blumen mit verschiedenen Blütezeiten',
                mulch: 'Rindenmulch zwischen Rosen und Stauden'
            },
            stauden: {
                mischkultur: 'Pflanze in Schichten: hohe Stauden hinten, niedrige vorne, Bodendecker dazwischen',
                duengung: 'Einmal Kompost im Frühjahr reicht – Stauden sind genügsam',
                schaedlinge: 'Samenstände im Winter stehen lassen – bieten Nützlingen Unterschlupf',
                mulch: 'Laub im Herbst liegen lassen – natürlicher Winterschutz und Humuslieferant'
            },
            straeucher: {
                mischkultur: 'Unterpflanzung mit Walderdbeeren, Waldmeister oder Bärlauch',
                duengung: 'Kompost-Ring um den Strauch – Regenwürmer verteilen die Nährstoffe',
                schaedlinge: 'Vogelschutzhecke: Holunder, Weißdorn, Schlehe bieten Nahrung & Nistplätze',
                mulch: 'Häckselgut vom Strauchschnitt direkt als Mulch verwenden'
            }
        };
        return tips[category] || tips.gemuese;
    }
};
