import type { Locale } from '../i18n';
import type { GuestMapIcon } from '../lib/guest-map-icons';
import { formatStraightLineDistance, isValidCoordinates, straightLineDistanceMeters, type Coordinates } from '../lib/distances';
import { guestWalks, type Walk, type WalkColor } from './guest-walks';

type Copy = { en: string; sl: string };
type Context = 'walks' | 'bled' | 'hiking' | 'trips' | 'food' | 'rainy';
type Place = {
  id: string;
  category: 'walks' | 'activities' | 'food';
  icon: GuestMapIcon;
  pinLabel: Copy;
  context: Context;
  query: string;
  coordinates: [number, number];
  sourceUrl: string;
  description: Copy;
  area: Copy;
  furtherAway?: boolean;
  line?: Coordinates[];
  color?: WalkColor;
  loop?: boolean;
  travelMode?: Walk['travelMode'];
};

// Menu groups follow the sections of the handwritten guest notebook.
export const guestPlaceGroups: { id: Context; label: Copy }[] = [
  { id: 'walks', label: { en: 'Walks from Nature Nook', sl: 'Sprehodi od Nature Nook' } },
  { id: 'bled', label: { en: 'Around Bled', sl: 'Okoli Bleda' } },
  { id: 'hiking', label: { en: 'Hiking & alpine valleys', sl: 'Pohodi in alpske doline' } },
  { id: 'trips', label: { en: 'Day trips', sl: 'Izleti' } },
  { id: 'food', label: { en: 'Eat like a local', sl: 'Jejte kot domačini' } },
  { id: 'rainy', label: { en: 'Rainy-day ideas', sl: 'Za deževne dni' } },
];

// Host recommendations from the guest notebook, not live listings.
// Coordinates checked against OpenStreetMap; source links identify the features.
// Lake, gorge, valley and village pins mark the area, not an entrance or trailhead.
// Data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
// Keep entries in menu-group order: the guided tour follows this order.
export const guestPlaces: Place[] = [
  {
    id: 'lake', category: 'activities', context: 'bled', icon: 'lake', query: 'Lake Bled Slovenia',
    coordinates: [46.3644, 14.0945], sourceUrl: 'https://www.openstreetmap.org/#map=16/46.3644/14.0945',
    pinLabel: { en: 'Lake Bled', sl: 'Blejsko jezero' },
    area: { en: 'Easy outing', sl: 'Lahek izlet' },
    description: { en: 'Walk around the lake, hire a boat or take a swim in warm weather. The pin marks the lake, not a particular entrance.', sl: 'Sprehodite se okoli jezera, najemite čoln ali se ob toplem vremenu okopajte. Oznaka prikazuje jezero, ne posameznega dostopa.' },
  },
  {
    id: 'straza', category: 'activities', context: 'bled', icon: 'viewpoint', query: 'Straža Bled',
    coordinates: [46.3599579, 14.1047382], sourceUrl: 'https://www.openstreetmap.org/node/8404730359',
    pinLabel: { en: 'Straža Hill', sl: 'Straža' },
    area: { en: 'About an hour’s walk uphill from the apartment', sl: 'Približno ura hoje navkreber od nastanitve' },
    description: { en: 'A small ski slope in winter and a walking destination in warmer seasons. Seasonal summer activities may operate at the top.', sl: 'Pozimi majhno smučišče, v toplejših mesecih cilj za sprehod. Poleti na vrhu včasih obratujejo sezonske dejavnosti.' },
  },
  {
    id: 'ojstrica', category: 'activities', context: 'bled', icon: 'viewpoint', query: 'Ojstrica Bled Slovenia',
    coordinates: [46.3596329, 14.0784584], sourceUrl: 'https://www.openstreetmap.org/node/472502272',
    pinLabel: { en: 'Ojstrica, Osojnica & Kozarca', sl: 'Ojstrica, Osojnica in Kozarca' },
    area: { en: 'Short–moderate hikes', sl: 'Krajši do zmerni vzponi' },
    description: { en: 'Three hills above the lake with memorable views of Bled, the Karavanke and Mt Stol. Choose a viewpoint walk that fits your ability; paths are steep in places. The pin marks Ojstrica.', sl: 'Trije hribi nad jezerom z nepozabnimi razgledi na Bled, Karavanke in Stol. Izberite razgledno pot, ki ustreza vaši pripravljenosti; poti so ponekod strme. Oznaka prikazuje Ojstrico.' },
  },
  {
    id: 'vintgar', category: 'activities', context: 'bled', icon: 'nature', query: 'Vintgar Gorge Slovenia', furtherAway: true,
    coordinates: [46.3986176, 14.0927488], sourceUrl: 'https://www.openstreetmap.org/way/702317076',
    pinLabel: { en: 'Vintgar Gorge', sl: 'Soteska Vintgar' },
    area: { en: 'Popular walk · check entry', sl: 'Priljubljen sprehod · preverite vstop' },
    description: { en: 'Wooden walkways and bridges follow the Radovna River through a dramatic limestone gorge to a waterfall. Check seasonal opening, entry arrangements and the return route before going. The pin marks the gorge, not its entrance.', sl: 'Lesene brvi in mostovi vodijo ob Radovni skozi slikovito apnenčasto sotesko do slapa. Pred odhodom preverite sezonsko odprtost, način vstopa in povratno pot. Oznaka prikazuje sotesko, ne vhoda.' },
  },
  {
    id: 'vogel', category: 'activities', context: 'bled', icon: 'viewpoint', query: 'Vogel cable car Bohinj', furtherAway: true,
    coordinates: [46.2755719, 13.835293], sourceUrl: 'https://www.openstreetmap.org/way/19789807',
    pinLabel: { en: 'Vogel cable car', sl: 'Žičnica Vogel' },
    area: { en: 'Half-day · Bohinj', sl: 'Pol dneva · Bohinj' },
    description: { en: 'Ride the gondola above Lake Bohinj for outstanding views. In summer there are walking routes, a chairlift and other activities. The pin marks the valley station.', sl: 'Z gondolo se zapeljite nad Bohinjsko jezero do izjemnih razgledov. Poleti so na voljo sprehajalne poti, sedežnica in druge dejavnosti. Oznaka prikazuje spodnjo postajo.' },
  },
  {
    id: 'mostnica', category: 'activities', context: 'bled', icon: 'nature', query: 'Korita Mostnice Stara Fužina', furtherAway: true,
    coordinates: [46.2981168, 13.8854905], sourceUrl: 'https://www.openstreetmap.org/way/1445227103',
    pinLabel: { en: 'Mostnica Gorge & Voje', sl: 'Korita Mostnice in Voje' },
    area: { en: 'About 2–3 hours', sl: 'Približno 2–3 ure' },
    description: { en: 'A beautiful walk through the gorge and towards the Voje valley, with a waterfall farther up the valley.', sl: 'Lep sprehod skozi korita proti dolini Voje, s slapom višje v dolini.' },
  },
  {
    id: 'uskovnica', category: 'activities', context: 'hiking', icon: 'nature', query: 'Planina Uskovnica', furtherAway: true,
    coordinates: [46.3216434, 13.907035], sourceUrl: 'https://www.openstreetmap.org/node/266844848',
    pinLabel: { en: 'Pokljuka → Uskovnica', sl: 'Pokljuka → Uskovnica' },
    area: { en: 'About 1 hour each way', sl: 'Približno 1 ura v eno smer' },
    description: { en: 'Walk across mountain pastures among cows, forests and traditional mountain scenery. Look out for local dairy products and food at alpine huts.', sl: 'Sprehod čez planinske pašnike med kravami, gozdovi in tradicionalno planinsko pokrajino. Poskusite domače mlečne izdelke in hrano v planinskih kočah.' },
  },
  {
    id: 'lipanca', category: 'activities', context: 'hiking', icon: 'nature', query: 'Blejska koča na Lipanci', furtherAway: true,
    coordinates: [46.3753174, 13.9275268], sourceUrl: 'https://www.openstreetmap.org/way/474809636',
    pinLabel: { en: 'Pokljuka → Lipanca', sl: 'Pokljuka → Lipanca' },
    area: { en: 'About 1.5 hours uphill', sl: 'Približno 1,5 ure navkreber' },
    description: { en: 'An uphill walk to Blejska koča na Lipanci, a mountain hut with alpine scenery and traditional food.', sl: 'Vzpon do Blejske koče na Lipanci, planinske koče z alpskimi razgledi in tradicionalno hrano.' },
  },
  {
    id: 'radovna', category: 'activities', context: 'hiking', icon: 'nature', query: 'Jezero Kreda Radovna', furtherAway: true,
    coordinates: [46.4163806, 13.991869], sourceUrl: 'https://www.openstreetmap.org/way/486922586',
    pinLabel: { en: 'Radovna & Krma valleys', sl: 'Radovna in Krma' },
    area: { en: 'Car or bike useful · 30–60 min drive', sl: 'Priporočljiv avto ali kolo · 30–60 min vožnje' },
    description: { en: 'Explore a beautiful valley with a very clear, cold river. Lake Kreda is a possible stop on the way; check swimming conditions and access locally. The pin marks Lake Kreda.', sl: 'Raziščite lepo dolino z zelo čisto, mrzlo reko. Jezero Kreda je lahko postanek na poti; pogoje za kopanje in dostop preverite na kraju samem. Oznaka prikazuje jezero Kreda.' },
  },
  {
    id: 'vrata', category: 'activities', context: 'hiking', icon: 'nature', query: 'Aljažev dom v Vratih', furtherAway: true,
    coordinates: [46.4090312, 13.8434212], sourceUrl: 'https://www.openstreetmap.org/way/288349283',
    pinLabel: { en: 'Vrata Valley', sl: 'Dolina Vrata' },
    area: { en: 'Full-day outing', sl: 'Celodnevni izlet' },
    description: { en: 'One of the great glacial valleys below Triglav. Visit the Slovenian Alpine Museum in Mojstrana and Peričnik Waterfall on the way. The pin marks Aljažev dom, near the head of the valley.', sl: 'Ena velikih ledeniških dolin pod Triglavom. Na poti obiščite Slovenski planinski muzej v Mojstrani in slap Peričnik. Oznaka prikazuje Aljažev dom blizu konca doline.' },
  },
  {
    id: 'pericnik', category: 'activities', context: 'hiking', icon: 'nature', query: 'Slap Peričnik', furtherAway: true,
    coordinates: [46.4392347, 13.8935276], sourceUrl: 'https://www.openstreetmap.org/node/90555440',
    pinLabel: { en: 'Peričnik Waterfall', sl: 'Slap Peričnik' },
    area: { en: 'Near Mojstrana', sl: 'Blizu Mojstrane' },
    description: { en: 'An impressive waterfall reached via a forest path. The path can be slippery or icy, particularly in winter.', sl: 'Mogočen slap, do katerega vodi gozdna pot. Pot je lahko spolzka ali poledenela, zlasti pozimi.' },
  },
  {
    id: 'triglav', category: 'activities', context: 'hiking', icon: 'viewpoint', query: 'Triglav Slovenia', furtherAway: true,
    coordinates: [46.3782982, 13.8365822], sourceUrl: 'https://www.openstreetmap.org/node/26864958',
    pinLabel: { en: 'Mount Triglav', sl: 'Triglav' },
    area: { en: 'Advanced alpine route · often 2 days', sl: 'Zahtevna visokogorska tura · pogosto 2 dni' },
    description: { en: 'Slovenia’s highest mountain. We suggest a two-day climb with a night in a hut and a sunrise summit. The upper routes are exposed, demanding alpine terrain: go only with proper experience, equipment and conditions, ideally with a qualified guide.', sl: 'Najvišja slovenska gora. Predlagamo dvodnevni vzpon s prenočitvijo v koči in vrhom ob sončnem vzhodu. Zgornji del poti je izpostavljen in zahteven: podajte se nanj le z ustreznimi izkušnjami, opremo in v dobrih razmerah, najbolje z usposobljenim vodnikom.' },
  },
  {
    id: 'seven-lakes', category: 'activities', context: 'hiking', icon: 'lake', query: 'Koča pri Triglavskih jezerih', furtherAway: true,
    coordinates: [46.3186819, 13.7790359], sourceUrl: 'https://www.openstreetmap.org/way/280441847',
    pinLabel: { en: 'Valley of the Seven Lakes', sl: 'Dolina Triglavskih jezer' },
    area: { en: 'Long alpine hike · 2–3 days', sl: 'Dolga visokogorska tura · 2–3 dni' },
    description: { en: 'A classic route through the Julian Alps and the Triglav Lakes Valley. We suggest 2–3 days; a very long one-day outing is only for exceptionally fit, experienced hikers. The pin marks Koča pri Triglavskih jezerih.', sl: 'Klasična pot skozi Julijske Alpe in Dolino Triglavskih jezer. Predlagamo 2–3 dni; v enem zelo dolgem dnevu le za izjemno pripravljene in izkušene planince. Oznaka prikazuje Kočo pri Triglavskih jezerih.' },
  },
  {
    id: 'bohinj', category: 'activities', context: 'trips', icon: 'lake', query: 'Lake Bohinj Slovenia', furtherAway: true,
    coordinates: [46.2822654, 13.8645306], sourceUrl: 'https://www.openstreetmap.org/relation/11315147',
    pinLabel: { en: 'Lake Bohinj', sl: 'Bohinjsko jezero' },
    area: { en: 'Half or full day', sl: 'Pol ali cel dan' },
    description: { en: 'An alpine lake for swimming, walking and boating. Combine it with Vogel, Savica Waterfall or a village visit.', sl: 'Alpsko jezero za kopanje, sprehode in čolnarjenje. Združite ga z Voglom, slapom Savica ali obiskom vasi.' },
  },
  {
    id: 'bohinj-villages', category: 'activities', context: 'trips', icon: 'landmark', query: 'Studor v Bohinju', furtherAway: true,
    coordinates: [46.2955449, 13.9074997], sourceUrl: 'https://www.openstreetmap.org/node/2914618302',
    pinLabel: { en: 'Stara Fužina, Studor & Češnjica', sl: 'Stara Fužina, Studor in Češnjica' },
    area: { en: 'Bohinj villages', sl: 'Bohinjske vasi' },
    description: { en: 'Traditional villages in the Bohinj area, worth exploring at an unhurried pace. The pin marks Studor.', sl: 'Tradicionalne bohinjske vasi, ki si jih je vredno ogledati brez naglice. Oznaka prikazuje Studor.' },
  },
  {
    id: 'kranjska-gora', category: 'activities', context: 'trips', icon: 'landmark', query: 'Kranjska Gora Slovenia', furtherAway: true,
    coordinates: [46.485132, 13.7843957], sourceUrl: 'https://www.openstreetmap.org/node/30162721',
    pinLabel: { en: 'Kranjska Gora', sl: 'Kranjska Gora' },
    area: { en: 'Full-day outing', sl: 'Celodnevni izlet' },
    description: { en: 'Mountain village and gateway to Lake Jasna, Vršič Pass and the Julian Alps.', sl: 'Gorska vas in izhodišče za jezero Jasna, prelaz Vršič in Julijske Alpe.' },
  },
  {
    id: 'jasna', category: 'activities', context: 'trips', icon: 'lake', query: 'Jezero Jasna Kranjska Gora', furtherAway: true,
    coordinates: [46.4741442, 13.7840065], sourceUrl: 'https://www.openstreetmap.org/way/36736687',
    pinLabel: { en: 'Lake Jasna', sl: 'Jezero Jasna' },
    area: { en: 'Easy stop', sl: 'Kratek postanek' },
    description: { en: 'Picturesque lakes just outside Kranjska Gora.', sl: 'Slikoviti jezeri tik ob Kranjski Gori.' },
  },
  {
    id: 'vrsic', category: 'activities', context: 'trips', icon: 'viewpoint', query: 'Vršič Pass', furtherAway: true,
    coordinates: [46.4347793, 13.7437123], sourceUrl: 'https://www.openstreetmap.org/node/16521909',
    pinLabel: { en: 'Vršič Pass', sl: 'Prelaz Vršič' },
    area: { en: 'Road trip · 1,611 m', sl: 'Izlet z avtom · 1611 m' },
    description: { en: 'A dramatic mountain road crossing with impressive scenery. The road can close in winter or bad weather.', sl: 'Slikovit gorski prelaz z mogočnimi razgledi. Pozimi ali ob slabem vremenu je cesta lahko zaprta.' },
  },
  {
    id: 'planica', category: 'activities', context: 'trips', icon: 'landmark', query: 'Planica Rateče', furtherAway: true,
    coordinates: [46.4662959, 13.7203785], sourceUrl: 'https://www.openstreetmap.org/way/244005192',
    pinLabel: { en: 'Planica & Tamar Valley', sl: 'Planica in Tamar' },
    area: { en: 'Half or full day', sl: 'Pol ali cel dan' },
    description: { en: 'See the famous ski-jumping area and walk into Tamar Valley.', sl: 'Oglejte si slavne skakalnice in se sprehodite v dolino Tamar.' },
  },
  {
    id: 'bovec', category: 'activities', context: 'trips', icon: 'landmark', query: 'Bovec Slovenia', furtherAway: true,
    coordinates: [46.3385847, 13.552419], sourceUrl: 'https://www.openstreetmap.org/node/44826837',
    pinLabel: { en: 'Bovec', sl: 'Bovec' },
    area: { en: 'Soča Valley', sl: 'Posočje' },
    description: { en: 'A base for outdoor activities such as rafting, kayaking and canyoning; book with qualified local providers.', sl: 'Izhodišče za dejavnosti v naravi, kot so rafting, kajak in soteskanje; rezervirajte pri usposobljenih lokalnih ponudnikih.' },
  },
  {
    id: 'union', category: 'food', context: 'food', icon: 'food', query: 'Gostilna Union Bled',
    coordinates: [46.368309, 14.1133672], sourceUrl: 'https://www.openstreetmap.org/node/770226725',
    pinLabel: { en: 'Gostilna Union', sl: 'Gostilna Union' },
    area: { en: 'Grill · Ljubljanska cesta', sl: 'Žar · Ljubljanska cesta' },
    description: { en: 'A grill close to the apartment. Check opening hours before heading over.', sl: 'Jedi z žara čisto blizu nastanitve. Pred obiskom preverite odpiralni čas.' },
  },
  {
    id: 'rustika', category: 'food', context: 'food', icon: 'food', query: 'Pizzeria Rustika Bled',
    coordinates: [46.3712844, 14.1042756], sourceUrl: 'https://www.openstreetmap.org/node/727450385',
    pinLabel: { en: 'Pizzeria Rustika', sl: 'Picerija Rustika' },
    area: { en: 'Pizza · Riklijeva cesta', sl: 'Pica · Riklijeva cesta' },
    description: { en: 'Our pizza recommendation in Bled. Check opening hours before heading over.', sl: 'Naš namig za pico na Bledu. Pred obiskom preverite odpiralni čas.' },
  },
  {
    id: 'grajska-plaza', category: 'food', context: 'food', icon: 'food', query: 'Grajska plaža Restaurant Bled',
    coordinates: [46.3693534, 14.1025672], sourceUrl: 'https://www.openstreetmap.org/node/2356196476',
    pinLabel: { en: 'Grajska plaža', sl: 'Grajska plaža' },
    area: { en: 'Lakeside · seasonal', sl: 'Ob jezeru · sezonsko' },
    description: { en: 'Lakeside dining in the Bled swimming area. Open seasonally; check before you go.', sl: 'Hrana ob jezeru na blejskem kopališču. Odprto sezonsko; preverite pred obiskom.' },
  },
  {
    id: 'peglezn', category: 'food', context: 'food', icon: 'food', query: 'Oštarija Peglez\'n Bled',
    coordinates: [46.3663566, 14.1082075], sourceUrl: 'https://www.openstreetmap.org/node/5316982836',
    pinLabel: { en: 'Oštarija Peglez’n', sl: 'Oštarija Peglez’n' },
    area: { en: 'Near the lake · Cesta svobode', sl: 'Blizu jezera · Cesta svobode' },
    description: { en: 'A restaurant near Lake Bled. Check opening hours before heading over.', sl: 'Restavracija blizu Blejskega jezera. Pred obiskom preverite odpiralni čas.' },
  },
  {
    id: 'pub-kitchen', category: 'food', context: 'food', icon: 'food', query: 'Pub Kitchen Bled',
    coordinates: [46.3707451, 14.1064472], sourceUrl: 'https://www.openstreetmap.org/node/14208353701',
    pinLabel: { en: 'Pub Kitchen', sl: 'Pub Kitchen' },
    area: { en: 'Pub food · Cesta svobode', sl: 'Pub s hrano · Cesta svobode' },
    description: { en: 'A pub with food in the centre of Bled. Check opening hours before heading over.', sl: 'Pub s hrano v središču Bleda. Pred obiskom preverite odpiralni čas.' },
  },
  {
    id: 'hotel-triglav', category: 'food', context: 'food', icon: 'food', query: 'Hotel Triglav Bled Restaurant 1906',
    coordinates: [46.3696415, 14.0837346], sourceUrl: 'https://www.openstreetmap.org/way/460184355',
    pinLabel: { en: 'Restaurant 1906', sl: 'Restavracija 1906' },
    area: { en: 'Hotel Triglav · special occasion', sl: 'Hotel Triglav · za posebne priložnosti' },
    description: { en: 'Higher-end dining overlooking Lake Bled. We recommend reserving a table.', sl: 'Vrhunska kulinarika z razgledom na Blejsko jezero. Priporočamo rezervacijo mize.' },
  },
  {
    id: 'kovinarska', category: 'food', context: 'food', icon: 'food', query: 'Kovinarska koča v Krmi', furtherAway: true,
    coordinates: [46.4005767, 13.923705], sourceUrl: 'https://www.openstreetmap.org/way/486923684',
    pinLabel: { en: 'Kovinarska koča', sl: 'Kovinarska koča' },
    area: { en: 'Krma Valley · mountain hut', sl: 'Dolina Krma · planinska koča' },
    description: { en: 'A mountain hut in Krma Valley with simple homemade food. Check opening before you go.', sl: 'Planinska koča v dolini Krma s preprosto domačo hrano. Pred obiskom preverite odprtost.' },
  },
  {
    id: 'psnak', category: 'food', context: 'food', icon: 'food', query: 'Pr Psnak Zgornja Radovna', furtherAway: true,
    coordinates: [46.431929, 13.9405828], sourceUrl: 'https://www.openstreetmap.org/way/1290385916',
    pinLabel: { en: 'Pr’ Psnak', sl: 'Pr’ Psnak' },
    area: { en: 'Radovna · homemade food', sl: 'Radovna · domača hrana' },
    description: { en: 'Traditional homemade cooking in the Radovna and Krma area. Check opening before you go.', sl: 'Tradicionalna domača kuhinja na območju Radovne in Krme. Pred obiskom preverite odprtost.' },
  },
  {
    id: 'tonkina', category: 'food', context: 'food', icon: 'food', query: 'Tonkina koča Vršič', furtherAway: true,
    coordinates: [46.4388138, 13.7538905], sourceUrl: 'https://www.openstreetmap.org/way/1248219193',
    pinLabel: { en: 'Tonkina koča', sl: 'Tonkina koča' },
    area: { en: 'Near Vršič Pass · mountain hut', sl: 'Blizu prelaza Vršič · planinska koča' },
    description: { en: 'A mountain hut known for its homemade food. Check opening before you go.', sl: 'Planinska koča, znana po domači hrani. Pred obiskom preverite odprtost.' },
  },
  {
    id: 'alpine-museum', category: 'activities', context: 'rainy', icon: 'landmark', query: 'Slovenski planinski muzej Mojstrana', furtherAway: true,
    coordinates: [46.4579405, 13.9362138], sourceUrl: 'https://www.openstreetmap.org/way/495622010',
    pinLabel: { en: 'Slovenian Alpine Museum', sl: 'Slovenski planinski muzej' },
    area: { en: 'Indoor museum · Mojstrana', sl: 'Muzej · Mojstrana' },
    description: { en: 'Discover mountaineering history in Mojstrana.', sl: 'Spoznajte zgodovino planinstva v Mojstrani.' },
  },
  {
    id: 'aquapark', category: 'activities', context: 'rainy', icon: 'lake', query: 'Aquapark Bohinj', furtherAway: true,
    coordinates: [46.2721731, 13.9570055], sourceUrl: 'https://www.openstreetmap.org/way/224061603',
    pinLabel: { en: 'Aquapark Bohinj', sl: 'Aquapark Bohinj' },
    area: { en: 'Family option · Bohinjska Bistrica', sl: 'Za družine · Bohinjska Bistrica' },
    description: { en: 'An indoor swimming option in Bohinjska Bistrica.', sl: 'Pokrito kopališče v Bohinjski Bistrici.' },
  },
];

const routeLength = (line: Coordinates[]) => line.slice(1).reduce((sum, point, index) => sum + straightLineDistanceMeters(line[index]!, point), 0);
const farthestPoint = (line: Coordinates[]) => line.reduce((best, point) => straightLineDistanceMeters(line[0]!, point) > straightLineDistanceMeters(line[0]!, best) ? point : best);

const topCentre = (line: Coordinates[]): Coordinates => {
  const longitudes = line.map((point) => point[1]);
  return [Math.max(...line.map((point) => point[0])), (Math.min(...longitudes) + Math.max(...longitudes)) / 2];
};

// A walk's pin sits at its destination, or at the turning point of a loop.
const walkPlaces: Place[] = guestWalks.map((walk) => {
  const pin = walk.loop ? farthestPoint(walk.line) : walk.line.at(-1)!;
  return {
    id: walk.id, category: 'walks', context: 'walks', icon: 'walk', query: '',
    coordinates: pin, sourceUrl: `https://www.openstreetmap.org/#map=17/${pin[0]}/${pin[1]}`,
    pinLabel: walk.pinLabel, area: walk.area, description: walk.description, furtherAway: walk.id === 'walk-sava',
    line: walk.line, color: walk.color, loop: walk.loop, travelMode: walk.travelMode,
  };
});

export function localizedGuestPlaces(locale: Locale, origin?: Coordinates) {
  const en = locale === 'en';
  return [...walkPlaces, ...guestPlaces].map((place) => {
    const distanceMeters = place.line ? routeLength(place.line)
      : isValidCoordinates(origin) ? straightLineDistanceMeters(origin, place.coordinates) : null;
    const start = place.line?.[0];
    const mapsUrl = !place.line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query)}`
      : place.loop ? null
      : `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${place.coordinates}&travelmode=${place.travelMode}`;
    return {
      ...place, pinLabel: place.pinLabel[locale], name: place.pinLabel[locale], description: place.description[locale], area: place.area[locale],
      contextLabel: guestPlaceGroups.find((group) => group.id === place.context)!.label[locale],
      distanceMeters, distanceLabel: distanceMeters === null ? null : formatStraightLineDistance(distanceMeters, locale),
      distanceNote: place.line
        ? (place.loop ? (en ? 'whole loop, along the drawn route' : 'celoten krog po narisani poti') : (en ? 'along the drawn route' : 'po narisani poti'))
        : (en ? 'straight line from your stay to the pin' : 'zračna razdalja od nastanitve do oznake'),
      mapsUrl,
      // A walk's card sits above the middle of its route so it never covers it.
      popupAt: place.line ? topCentre(place.line) : null,
    };
  });
}
