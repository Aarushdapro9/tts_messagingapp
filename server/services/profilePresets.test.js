import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_PROFILE_PRESETS, randomAnimalProfilePreset } from './profilePresets.js';

test('random animal profile preset stays within the preset collection', () => {
  assert.equal(randomAnimalProfilePreset(() => 0), ANIMAL_PROFILE_PRESETS[0]);
  assert.equal(randomAnimalProfilePreset(() => 0.999999), ANIMAL_PROFILE_PRESETS.at(-1));
});
