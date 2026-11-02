export const ANIMAL_PROFILE_PRESETS = Object.freeze([
  'preset:animal-horse',
  'preset:animal-zebra',
  'preset:animal-antelope',
  'preset:animal-deer',
  'preset:animal-crocodile',
  'preset:animal-rhinoceros',
  'preset:animal-gazelle',
  'preset:animal-giraffe',
  'preset:animal-gorilla',
  'preset:animal-chimpanzee',
  'preset:animal-orangutan',
  'preset:animal-monkey',
]);

export function randomAnimalProfilePreset(random = Math.random) {
  return ANIMAL_PROFILE_PRESETS[Math.floor(random() * ANIMAL_PROFILE_PRESETS.length)];
}
