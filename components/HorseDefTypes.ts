import { Record } from 'immutable';
import { SortedSet } from 'immutable-sorted';

import skill_meta from '../skill_meta.json';

function skillmeta(id: string) {
	// handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
	return skill_meta[id.split('-')[0]];
}

function skillComparator(a, b) {
	const x = skillmeta(a).order, y = skillmeta(b).order;
	return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

export function SkillSet(iterable): SortedSet<keyof typeof skills> {
	return SortedSet(iterable, skillComparator);
}

export class HorseState extends Record({
	outfitId: '',
	speed:   CC_GLOBAL ? 1200 : 1850,
	stamina: CC_GLOBAL ? 1200 : 1700,
	power:   CC_GLOBAL ? 800 : 1700,
	guts:    CC_GLOBAL ? 400 : 1200,
	wisdom:  CC_GLOBAL ? 400 : 1300,
	strategy: 'Senkou',
	distanceAptitude: 'S',
	surfaceAptitude: 'A',
	strategyAptitude: 'A',
	skills: SkillSet([])
}) {}
