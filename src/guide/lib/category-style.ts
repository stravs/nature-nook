import type { IconName } from './icons';

// Shared by list cards and map pins so both use the same colour and icon.
export const categoryStyle: Record<string, { icon: IconName; color: string }> = {
  walks: { icon: 'walk', color: 'bg-[#2d5d7b]' },
  'food-drinks': { icon: 'food', color: 'bg-clay' },
  hiking: { icon: 'hiking', color: 'bg-moss' },
  'day-trips': { icon: 'trip', color: 'bg-forest' },
  'rainy-day': { icon: 'rain', color: 'bg-[#4f5b6b]' },
};
