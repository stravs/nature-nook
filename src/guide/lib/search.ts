export interface SearchDocument {
  id: string;
  kind: 'apartment' | 'place';
  title: string;
  answer: string;
  aliases: string[];
  body: string;
  href: string;
  copy?: string | null;
  mapId?: string | undefined;
}
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/wi[\s‐‑–—-]*fi/g, 'wifi').replace(/check[\s‐‑–—-]*out/g, 'checkout').replace(/check[\s‐‑–—-]*in/g, 'checkin')
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
const stopWords = new Set('what whats is the a an how do i can we where when are our my to for of get find me please does it at time you tell need have use should nearby good kje je so kako kaj kdaj se lahko mi za v na ob koliko'.split(' '));
const aliases: Record<string, string> = {
  wireless: 'wifi', wlan: 'wifi', internet: 'wifi', odjava: 'checkout', odhod: 'checkout', leaving: 'checkout', departure: 'checkout',
  pica: 'pizza', dez: 'rain', rainy: 'rain', raining: 'rain', restaurants: 'restaurant', reach: 'contact', restavracija: 'restaurant', dinner: 'restaurant', food: 'restaurant', eat: 'restaurant',
  parkiranje: 'parking', park: 'parking', pomoc: 'help', gostitelj: 'host', geslo: 'password', kljuci: 'keys',
};
export function termsFor(query: string): string[] {
  return normalize(query).split(' ').filter(term => term && !stopWords.has(term)).map(term => aliases[term] ?? term);
}
export function searchDocuments(documents: SearchDocument[], query: string): SearchDocument[] {
  const terms = termsFor(query);
  if (!terms.length) return [];
  return documents.map((doc, order) => {
    const title = termsFor(doc.title).join(' ');
    const alias = termsFor(doc.aliases.join(' ')).join(' ');
    const body = termsFor(`${doc.answer} ${doc.body}`).join(' ');
    if (!terms.every(term => `${title} ${alias} ${body}`.includes(term))) return { doc, order, score: -1 };
    const score = title === terms.join(' ') ? 1000 : title.startsWith(terms.join(' ')) ? 900 :
      terms.reduce((score, term) => score + (title.includes(term) ? 40 : alias.includes(term) ? 20 : 1), 0);
    return { doc, order, score };
  }).filter(result => result.score >= 0).sort((a, b) => b.score - a.score || a.order - b.order).map(result => result.doc);
}
