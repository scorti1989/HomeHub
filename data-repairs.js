'use strict';
// Scoped to records and field values observed in the supplied backup.
const HH_KNOWN_REPAIRS = [
  {
    "collection": "expenses",
    "id": "msu3bxpmaseofw5pn6h",
    "field": "category",
    "before": "lebensmittel",
    "after": "freizeit"
  },
  {
    "collection": "expenses",
    "id": "msu3bxpmaseofw5pn6h",
    "field": "analysisGroup",
    "before": "freizeit",
    "after": "freizeit"
  },
  {
    "collection": "expenses",
    "id": "muwttfzt173c9kmrpn5",
    "field": "category",
    "before": "lebensmittel",
    "after": "freizeit"
  },
  {
    "collection": "expenses",
    "id": "muwttfzt173c9kmrpn5",
    "field": "analysisGroup",
    "before": "alltag",
    "after": "freizeit"
  },
  {
    "collection": "recipes",
    "id": "mpsrnvja1at8cozx5mh",
    "field": "steps",
    "before": [],
    "after": [
      "Den Ofen auf 200 °C Umluft vorheizen. Zucchini würfeln, Zwiebel in Spalten schneiden und Tomaten waschen.",
      "Gewürzmischung mit Öl verrühren. Gemüse und Gnocchi darin wenden und in einer Auflaufform ungefähr 20 Minuten garen.",
      "Feta zerkleinern und auf dem gemischten Ofengemüse verteilen. Weitere fünf Minuten überbacken; gehackte Petersilie beim Servieren hinzufügen."
    ],
    "sourceUrl": "https://www.penny.de/clever-kochen/rezepte-und-ernaehrung/gnocchi-mit-gemuese-und-feta-penny"
  },
  {
    "collection": "recipes",
    "id": "mpsrnvja1at8cozx5mh",
    "field": "ingredients",
    "before": [
      "100 g Zucchini",
      "0.5  kleine rote Zwiebel(n)",
      "100 g Cocktailtomaten",
      "1 TL italienische Gew&uuml;rzmischung (z.B. W&uuml;rz&amp;Co)",
      "1.5 EL Sonnenblumen&ouml;l",
      "200 g frische Gnocchi aus dem K&uuml;hlregal (z.B. Penny Ready)",
      "75 g Feta-K&auml;se (z.B. Naturgut)",
      "3 Stiele Petersilie"
    ],
    "after": [
      "100 g Zucchini",
      "0.5  kleine rote Zwiebel(n)",
      "100 g Cocktailtomaten",
      "1 TL italienische Gewürzmischung (z.B. Würz&Co)",
      "1.5 EL Sonnenblumenöl",
      "200 g frische Gnocchi aus dem Kühlregal (z.B. Penny Ready)",
      "75 g Feta-Käse (z.B. Naturgut)",
      "3 Stiele Petersilie"
    ],
    "sourceUrl": "https://www.penny.de/clever-kochen/rezepte-und-ernaehrung/gnocchi-mit-gemuese-und-feta-penny"
  },
  {
    "collection": "recipes",
    "id": "mpsrnvja1at8cozx5mh",
    "field": "ingredientsRaw",
    "before": "100 g Zucchini\n0.5  kleine rote Zwiebel(n)\n100 g Cocktailtomaten\n1 TL italienische Gew&uuml;rzmischung (z.B. W&uuml;rz&amp;Co)\n1.5 EL Sonnenblumen&ouml;l\n200 g frische Gnocchi aus dem K&uuml;hlregal (z.B. Penny Ready)\n75 g Feta-K&auml;se (z.B. Naturgut)\n3 Stiele Petersilie",
    "after": "100 g Zucchini\n0.5  kleine rote Zwiebel(n)\n100 g Cocktailtomaten\n1 TL italienische Gewürzmischung (z.B. Würz&Co)\n1.5 EL Sonnenblumenöl\n200 g frische Gnocchi aus dem Kühlregal (z.B. Penny Ready)\n75 g Feta-Käse (z.B. Naturgut)\n3 Stiele Petersilie",
    "sourceUrl": "https://www.penny.de/clever-kochen/rezepte-und-ernaehrung/gnocchi-mit-gemuese-und-feta-penny"
  },
  {
    "collection": "recipes",
    "id": "mpso16v617palo0k6jb",
    "field": "steps",
    "before": [],
    "after": [
      "Quark, Haferflocken, Eier, Backpulver, Salz und gewünschte optionale Zutaten zu einem Teig vermengen. Eine Kastenform einfetten und den Teig einfüllen.",
      "Bei Ober-/Unterhitze und 180 °C ungefähr 50 Minuten backen. Vor dem Herausnehmen in der Form auskühlen lassen."
    ],
    "sourceUrl": "https://www.chefkoch.de/rezepte/3044761457166814/Haferflockenbrot.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpso16v617palo0k6jb",
    "field": "ingredientsRaw",
    "before": "500 g Magerquark\n500 g Haferflocken, kernige\n3  Ei(er)\n2 Tüte/n Backpulver\n1 TL Salz\n evtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)\n  Fett für die Form",
    "after": "500 g Magerquark\n500 g Haferflocken, kernige\n3  Ei(er)\n2 Tüte/n Backpulver\n1 TL Salz\nevtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)\nFett für die Form",
    "sourceUrl": "https://www.chefkoch.de/rezepte/3044761457166814/Haferflockenbrot.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnzf0g1v57k37tmgi",
    "field": "ingredients",
    "before": [
      "500 g Magerquark",
      "500 g Haferflocken, kernige",
      "3  Ei(er)",
      "2 Tüte/n Backpulver",
      "1 TL Salz",
      "evtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)",
      "Fett für die Form"
    ],
    "after": [
      "350 g Maronen",
      "1 große Gemüsezwiebel",
      "700 ml Wasser",
      "2 TL Instant-Gemüsebrühe",
      "1 Würfel Rinderbouillon",
      "1 Becher Sahne",
      "0,5 TL Nelken",
      "1 Prise Zimt",
      "Pfeffer"
    ],
    "sourceUrl": "https://www.chefkoch.de/rezepte/1869401303737676/Koestliche-Maronensuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnzf0g1v57k37tmgi",
    "field": "steps",
    "before": [],
    "after": [
      "Maronen schälen und die Zwiebel zerkleinern. Die Zwiebel mit etwas Öl anschwitzen, dann Maronen und weitere Zutaten hinzufügen.",
      "Etwa 20 Minuten bei mittlerer Hitze garen, anschließend pürieren. Bei Bedarf mit Wasser verdünnen. Ohne Rinderbouillon ist die Suppe vegetarisch; dann mit Salz abschmecken."
    ],
    "sourceUrl": "https://www.chefkoch.de/rezepte/1869401303737676/Koestliche-Maronensuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnzf0g1v57k37tmgi",
    "field": "ingredientsRaw",
    "before": "500 g Magerquark\n500 g Haferflocken, kernige\n3  Ei(er)\n2 Tüte/n Backpulver\n1 TL Salz\n evtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)\n  Fett für die Form",
    "after": "350 g Maronen\n1 große Gemüsezwiebel\n700 ml Wasser\n2 TL Instant-Gemüsebrühe\n1 Würfel Rinderbouillon\n1 Becher Sahne\n0,5 TL Nelken\n1 Prise Zimt\nPfeffer",
    "sourceUrl": "https://www.chefkoch.de/rezepte/1869401303737676/Koestliche-Maronensuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnynrdmwiigbgkop",
    "field": "ingredients",
    "before": [
      "500 g Magerquark",
      "500 g Haferflocken, kernige",
      "3  Ei(er)",
      "2 Tüte/n Backpulver",
      "1 TL Salz",
      "evtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)",
      "Fett für die Form"
    ],
    "after": [
      "5 große Kartoffeln",
      "1 Möhre",
      "1 Stange Lauch",
      "1 Zwiebel",
      "1 Liter Gemüsebrühe",
      "Petersilie",
      "Pfeffer",
      "2 Wiener Würstchen",
      "Geröstete Weißbrotwürfel",
      "Schnittlauch",
      "Majoran",
      "Lorbeerblätter",
      "Muskat"
    ],
    "sourceUrl": "https://www.chefkoch.de/rezepte/18351004366867/Kartoffelsuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnynrdmwiigbgkop",
    "field": "steps",
    "before": [],
    "after": [
      "Kartoffeln und Möhre in Stücke schneiden, Zwiebel würfeln und Lauch in Ringe schneiden. Zwiebel in etwas Olivenöl anschwitzen, dann Lauch hinzufügen.",
      "Brühe, Kartoffeln, Möhre und Lorbeer zugeben. Im Schnellkochtopf unter Druck rund 15 Minuten garen. Vor dem Öffnen nach Geräteanleitung den Druck abbauen.",
      "Lorbeer entfernen, Kräuter hinzufügen und pürieren. Pfeffer und Muskat zum Abschmecken verwenden. Mit geschnittenen Wienern und geröstetem Weißbrot servieren."
    ],
    "sourceUrl": "https://www.chefkoch.de/rezepte/18351004366867/Kartoffelsuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnynrdmwiigbgkop",
    "field": "ingredientsRaw",
    "before": "500 g Magerquark\n500 g Haferflocken, kernige\n3  Ei(er)\n2 Tüte/n Backpulver\n1 TL Salz\n evtl. Röstzwiebeln (oder Rosmarin oder magere Schinkenwürfel)\n  Fett für die Form",
    "after": "5 große Kartoffeln\n1 Möhre\n1 Stange Lauch\n1 Zwiebel\n1 Liter Gemüsebrühe\nPetersilie\nPfeffer\n2 Wiener Würstchen\nGeröstete Weißbrotwürfel\nSchnittlauch\nMajoran\nLorbeerblätter\nMuskat",
    "sourceUrl": "https://www.chefkoch.de/rezepte/18351004366867/Kartoffelsuppe.html?utm_medium=sharing&utm_source=chefkoch_android_app&utm_campaign=sharing_rds_ck_android"
  },
  {
    "collection": "recipes",
    "id": "mpsnvxpqihaozl1pkwh",
    "field": "steps",
    "before": [],
    "after": [
      "Zwiebel und Knoblauch fein schneiden und in Öl anschwitzen. Hackfleisch hinzufügen und krümelig durchbraten.",
      "Passierte Tomaten, in 150 ml Wasser gelöstes Brühepulver, Oregano und Zucker einrühren. Fünf Minuten köcheln, dann würzen.",
      "Soße und Lasagneplatten abwechselnd in eine Auflaufform geben. Crème fraîche und Käse oben verteilen. Bei 200 °C Ober-/Unterhitze etwa 30 Minuten backen."
    ],
    "sourceUrl": "https://www.familienkost.de/rezept_schnelle_lasagne.html"
  },
  {
    "collection": "recipes",
    "id": "mpsnvxpqihaozl1pkwh",
    "field": "ingredients",
    "before": [
      "12 Lasagneplatten",
      "200 g geriebener K&auml;se",
      "200 g Creme Fraiche",
      "1 Zwiebel",
      "2 Knoblauchzehen",
      "1 Liter passierte Tomaten",
      "1 EL Oliven&ouml;l",
      "500 g Hackfleisch (gemischt)",
      "1 TL Oregano",
      "3 TL Gem&uuml;sebr&uuml;hpulver",
      "1 Prise Zucker",
      "Salz und Pfeffer"
    ],
    "after": [
      "12 Lasagneplatten",
      "200 g geriebener Käse",
      "200 g Creme Fraiche",
      "1 Zwiebel",
      "2 Knoblauchzehen",
      "1 Liter passierte Tomaten",
      "1 EL Olivenöl",
      "500 g Hackfleisch (gemischt)",
      "1 TL Oregano",
      "3 TL Gemüsebrühpulver",
      "1 Prise Zucker",
      "Salz und Pfeffer"
    ],
    "sourceUrl": "https://www.familienkost.de/rezept_schnelle_lasagne.html"
  },
  {
    "collection": "recipes",
    "id": "mpsnvxpqihaozl1pkwh",
    "field": "ingredientsRaw",
    "before": "12 Lasagneplatten\n200 g geriebener K&auml;se\n200 g Creme Fraiche\n1 Zwiebel\n2 Knoblauchzehen\n1 Liter passierte Tomaten\n1 EL Oliven&ouml;l\n500 g Hackfleisch (gemischt)\n1 TL Oregano\n3 TL Gem&uuml;sebr&uuml;hpulver\n1 Prise Zucker\nSalz und Pfeffer",
    "after": "12 Lasagneplatten\n200 g geriebener Käse\n200 g Creme Fraiche\n1 Zwiebel\n2 Knoblauchzehen\n1 Liter passierte Tomaten\n1 EL Olivenöl\n500 g Hackfleisch (gemischt)\n1 TL Oregano\n3 TL Gemüsebrühpulver\n1 Prise Zucker\nSalz und Pfeffer",
    "sourceUrl": "https://www.familienkost.de/rezept_schnelle_lasagne.html"
  },
  {
    "collection": "recipes",
    "id": "mpsn0c4obwvitts3tes",
    "field": "ingredients",
    "before": [],
    "after": [
      "250 g rote Linsen",
      "1 Zwiebel",
      "1 Knoblauchzehe",
      "1 Möhre (ca. 100 g)",
      "1 Kartoffel",
      "1 EL Olivenöl",
      "1,4 Liter Gemüsebrühe",
      "Salz und Pfeffer",
      "2 EL Olivenöl für das Topping",
      "1 TL getrocknete Minze",
      "1 TL Paprikapulver, edelsüß",
      "Zitronenspalten"
    ],
    "sourceUrl": "https://www.gaumenfreundin.de/tuerkische-linsensuppe/"
  },
  {
    "collection": "recipes",
    "id": "mpsn0c4obwvitts3tes",
    "field": "steps",
    "before": [],
    "after": [
      "Die Linsen waschen. Zwiebel und Knoblauch zerkleinern; Möhre und Kartoffel schälen und würfeln.",
      "Gemüse und Linsen in einem Esslöffel Öl kurz anschwitzen. Brühe hinzufügen, aufkochen und bei kleiner Hitze 20 bis 30 Minuten garen.",
      "Suppe pürieren und würzen. Für das Topping zwei Esslöffel Öl erwärmen und Minze sowie Paprika einrühren. Mit dem Würzöl und Zitronenspalten servieren."
    ],
    "sourceUrl": "https://www.gaumenfreundin.de/tuerkische-linsensuppe/"
  },
  {
    "collection": "recipes",
    "id": "mpsn0c4obwvitts3tes",
    "field": "ingredientsRaw",
    "before": null,
    "after": "250 g rote Linsen\n1 Zwiebel\n1 Knoblauchzehe\n1 Möhre (ca. 100 g)\n1 Kartoffel\n1 EL Olivenöl\n1,4 Liter Gemüsebrühe\nSalz und Pfeffer\n2 EL Olivenöl für das Topping\n1 TL getrocknete Minze\n1 TL Paprikapulver, edelsüß\nZitronenspalten",
    "sourceUrl": "https://www.gaumenfreundin.de/tuerkische-linsensuppe/"
  },
  {
    "collection": "recipes",
    "id": "mpsn0c4obwvitts3tes",
    "field": "baseServings",
    "before": null,
    "after": 4,
    "sourceUrl": "https://www.gaumenfreundin.de/tuerkische-linsensuppe/"
  },
  {
    "collection": "recipes",
    "id": "mpsn0c4obwvitts3tes",
    "field": "originalServings",
    "before": null,
    "after": 4,
    "sourceUrl": "https://www.gaumenfreundin.de/tuerkische-linsensuppe/"
  }
];

function repairKnownSnapshot(snapshot) {
  const changes = [];
  for (const patch of HH_KNOWN_REPAIRS) {
    if (JSON.stringify(patch.before) === JSON.stringify(patch.after)) continue;
    const row = snapshot[patch.collection]?.find(x => x.id === patch.id);
    if (!row || (patch.sourceUrl && row.sourceUrl !== patch.sourceUrl)) continue;
    if (JSON.stringify(row[patch.field] ?? null) !== JSON.stringify(patch.before)) continue;
    if (patch.collection === 'recipes') {
      const ingredientPatch = HH_KNOWN_REPAIRS.find(p=>p.collection==='recipes' && p.id===patch.id && p.field==='ingredients');
      if (ingredientPatch && ![ingredientPatch.before,ingredientPatch.after].some(v=>JSON.stringify(v)===JSON.stringify(row.ingredients))) continue;
    }
    // Ingredient changes are coupled to the original portion baseline.
    if (patch.collection === 'recipes' && ['ingredients','ingredientsRaw'].includes(patch.field)) {
      const expectedServings = patch.id === 'mpsnzf0g1v57k37tmgi' ? 6 : patch.id === 'mpsnynrdmwiigbgkop' ? 4 : patch.id === 'mpsn0c4obwvitts3tes' ? 4 : null;
      if (expectedServings && row.servings !== expectedServings) continue;
    }
    row[patch.field] = JSON.parse(JSON.stringify(patch.after));
    changes.push({collection:patch.collection,id:patch.id,field:patch.field});
  }
  return changes;
}
function repairKnownLiveData() {
  const snapshot = JSON.parse(JSON.stringify(collectAppSnapshot()));
  const changes = repairKnownSnapshot(snapshot);
  if (!changes.length) return;
  saveRecoverySnapshot(collectAppSnapshot(), 'hh_recovery_data_repair');
  applyAppSnapshot(snapshot);
  localStorage.setItem('vh_sync_dirty', String(Date.now())+'-data-repair');
  console.info('[HomeHub] Belegte Datenkorrekturen:', changes.length);
}
