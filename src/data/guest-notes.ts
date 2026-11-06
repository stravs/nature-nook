import type { Locale } from '../i18n';

type Copy = { en: string; sl: string };
type NoteSection = { id: string; title: Copy; items: { title: Copy; text: Copy }[] };

// Text-only tips from the handwritten guest notebook (no map pin).
const sections: NoteSection[] = [
  {
    id: 'day-trips',
    title: { en: 'Suggested one-day trips', sl: 'Predlogi za enodnevne izlete' },
    items: [
      {
        title: { en: 'Pokljuka and Uskovnica', sl: 'Pokljuka in Uskovnica' },
        text: { en: 'Drive to Pokljuka (Rudno Polje), park and hike to Uskovnica through mountain meadows with cows and traditional cheesemaking. Stop at a mountain hut for local food. Allow about 1 hour of easy walking each way.', sl: 'Zapeljite se na Pokljuko (Rudno polje), parkirajte in se odpravite na Uskovnico čez planinske travnike s kravami in tradicionalnim sirarstvom. V planinski koči se ustavite na domači hrani. Računajte na približno uro lahke hoje v vsako smer.' },
      },
      {
        title: { en: 'Pokljuka and Lipanca', sl: 'Pokljuka in Lipanca' },
        text: { en: 'Hike uphill from Pokljuka to the Blejska koča na Lipanci hut. Allow about 1.5 hours uphill.', sl: 'S Pokljuke se povzpnite do Blejske koče na Lipanci. Računajte na približno 1,5 ure vzpona.' },
      },
      {
        title: { en: 'Radovna and Krma valleys', sl: 'Dolini Radovna in Krma' },
        text: { en: 'Explore the clear Radovna River and the glacial Krma Valley. Stop at Lake Kreda (where conditions permit), Kovinarska koča and Pr’ Psnak for traditional homemade food.', sl: 'Raziščite čisto Radovno in ledeniško dolino Krma. Ustavite se ob jezeru Kreda (če razmere dopuščajo), v Kovinarski koči in pri Psnaku na tradicionalni domači hrani.' },
      },
      {
        title: { en: 'Scenic drive around Triglav National Park', sl: 'Krožna vožnja okoli Triglavskega narodnega parka' },
        text: { en: 'Bled → Kranjska Gora → Vršič Pass → Trenta Valley → Bovec → Kobarid → Most na Soči → Bohinj → Bled. A car train runs from Most na Soči towards Bohinj; check the current timetable and arrive ahead of departure, as service is not guaranteed. If necessary, return by road over Soriška planina.', sl: 'Bled → Kranjska Gora → prelaz Vršič → dolina Trenta → Bovec → Kobarid → Most na Soči → Bohinj → Bled. Z Mosta na Soči proti Bohinju vozi avtovlak; preverite aktualni vozni red in pridite pred odhodom, saj vožnja ni zagotovljena. Po potrebi se vrnite po cesti čez Soriško planino.' },
      },
    ],
  },
  {
    id: 'more-tips',
    title: { en: 'More from our notebook', sl: 'Še iz naše beležke' },
    items: [
      {
        title: { en: 'Postojna Cave', sl: 'Postojnska jama' },
        text: { en: 'A famous cave experience with guided visits. A day trip from Bled; book tickets in advance.', sl: 'Znamenita jama z vodenimi ogledi. Celodnevni izlet z Bleda; vstopnice kupite vnaprej.' },
      },
      {
        title: { en: 'Škocjan Caves', sl: 'Škocjanske jame' },
        text: { en: 'Spectacular UNESCO-listed caves; a longer day trip from Bled. Book tickets in advance.', sl: 'Veličastne jame na Unescovem seznamu; daljši izlet z Bleda. Vstopnice kupite vnaprej.' },
      },
      {
        title: { en: 'Indoor swimming & wellness', sl: 'Pokriti bazeni in wellness' },
        text: { en: 'Several hotels around Bled have swimming pools. Ask them about access for day guests.', sl: 'Več hotelov na Bledu ima bazene. Povprašajte jih o dostopu za dnevne goste.' },
      },
    ],
  },
  {
    id: 'good-to-know',
    title: { en: 'Good to know', sl: 'Dobro je vedeti' },
    items: [
      {
        title: { en: 'Ask the locals', sl: 'Vprašajte domačine' },
        text: { en: 'Locals are happy to help with advice or directions.', sl: 'Domačini vam bodo z veseljem svetovali ali pokazali pot.' },
      },
      {
        title: { en: 'Tipping', sl: 'Napitnina' },
        text: { en: 'Tips are welcome when service has been particularly good.', sl: 'Napitnina je dobrodošla, kadar je bila postrežba posebej dobra.' },
      },
      {
        title: { en: 'Drinking water', sl: 'Pitna voda' },
        text: { en: 'Tap water around Bled is generally drinkable, so carry a reusable bottle. For mountain trips, bring your own water.', sl: 'Voda iz pipe na Bledu je praviloma pitna, zato imejte s seboj steklenico za večkratno uporabo. Na izlete v gore vzemite s seboj dovolj vode.' },
      },
      {
        title: { en: 'Trail maps', sl: 'Zemljevidi poti' },
        text: { en: 'Take a photo of the map at the trailhead; it often helps on the way.', sl: 'Fotografirajte zemljevid na izhodišču poti; na poti vam bo prišel prav.' },
      },
      {
        title: { en: 'Before you go', sl: 'Pred odhodom' },
        text: { en: 'Check route conditions, seasonal access and transport details before setting out.', sl: 'Pred odhodom preverite razmere na poti, sezonski dostop in prevoz.' },
      },
    ],
  },
];

export function localizedGuestNotes(locale: Locale) {
  return sections.map((section) => ({
    id: section.id, title: section.title[locale],
    items: section.items.map((item) => ({ title: item.title[locale], text: item.text[locale] })),
  }));
}
