import { h, Fragment, render } from 'preact';
import { Text, IntlProvider } from 'preact-i18n';

import { SkillList } from '../components/SkillList';

import { RaceTrack, RegionDisplayType } from '../components/RaceTrack';

import skills from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';

import { Region, RegionList } from '../uma-skill-tools/Region';
import { CourseData, CourseHelpers } from '../uma-skill-tools/CourseData';
import { HorseParameters, Strategy, Aptitude } from '../uma-skill-tools/HorseTypes';
import { buildSkillData, conditionsWithActivateCountsAsRandom } from '../uma-skill-tools/RaceSolverBuilder';
import { ImmediatePolicy } from '../uma-skill-tools/ActivationSamplePolicy';
import { immediate, noopImmediate } from '../uma-skill-tools/ActivationConditions';

const horse = Object.freeze({
	speed: 2000,
	stamina: 2000,
	power: 2000,
	guts: 2000,
	wisdom: 2000,
	strategy: Strategy.Nige,
	distanceAptitude: Aptitude.S,
	surfaceAptitude: Aptitude.A,
	strategyAptitde: Aptitude.A,
	rawStamina: 2000
});

function baseSpeed(distance: number) {
	return 20.0 - (distance - 2000) / 1000.0;
}

const conditions = Object.freeze(Object.assign({}, conditionsWithActivateCountsAsRandom, {
	accumulatetime: immediate({
		filterGte(regions: RegionList, t: number, course: CourseData, _: HorseParameters) {
			// obviously we can't know this condition without actually running the race, and the actual distance traveled depends on the uma's strategy, power stat,
			// skills (opening leg accel skills), and other things that aren't available in a static environment like here. so intead guess approximately how far we
			// travel in t seconds by just using the course base speed.
			// this will typically be a bit high since umas need to accelerate and non-nige strategies have lower than 1.0 StrategyPhaseCoefficient for phase 0
			// except for oonige in which case it could be a bit low since their phase 0 speed is so high
			const estimate = new Region(baseSpeed(course.distance) * t, course.distance);
			return regions.rmap(r => r.intersect(estimate));
		}
	}),
	running_style: noopImmediate
}));

function regionsForSkill(course: CourseData, skillId: string) {
	const wholeCourse = new RegionList();
	wholeCourse.push(new Region(0, course.distance));
	const sd = buildSkillData(horse, course, wholeCourse, conditions, skillId);
	return {
		type: sd.samplePolicy == ImmediatePolicy ? RegionDisplayType.Immediate : RegionDisplayType.Regions,
		regions: sd.regions
	};
}

function App(props) {
	const skilldefs = {skillnames: {}};
	const lang = +(props.lang == 'en');
	Object.keys(skillnames).forEach(id => skilldefs.skillnames[id] = skillnames[id][lang]);
	const c11203 = CourseHelpers.getCourse('11203'); 
	return (
		<IntlProvider definition={skilldefs}>
			<RaceTrack courseid="11203" width="800" height="220" regions={[regionsForSkill(c11203, '201452')]} /><div style="width:1000px;height:50px;overflow:hidden" />
			<RaceTrack courseid="10805" width="800" height="220" /><div style="width:1000px;height:50px;overflow:hidden" />
			<RaceTrack courseid="10810" width="800" height="220" />
			<SkillList ids={Object.keys(skills).filter(id => skills[id].rarity < 3 || skills[id].rarity > 5)} />
		</IntlProvider>
	);
}

render(<App lang="ja" />, document.getElementById('app'));
