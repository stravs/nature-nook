export const guideCategoryIds = ['food-drinks', 'day-trips', 'useful-info', 'rainy-day', 'hiking'] as const;
export type GuideCategory = typeof guideCategoryIds[number];

export const guideCategories = [
  { id: 'food-drinks', label: { en: 'Food & drinks', sl: 'Hrana in pijača' } },
  { id: 'day-trips', label: { en: 'Day trips', sl: 'Enodnevni izleti' } },
  { id: 'useful-info', label: { en: 'Useful info', sl: 'Koristne informacije' } },
  { id: 'rainy-day', label: { en: 'Rainy-day activities', sl: 'Dejavnosti za deževne dni' } },
  { id: 'hiking', label: { en: 'Hiking & local walks', sl: 'Pohodništvo in sprehodi' } },
] satisfies { id: GuideCategory; label: { en: string; sl: string } }[];
