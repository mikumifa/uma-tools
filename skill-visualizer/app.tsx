import { h, render } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import { Text, IntlProvider } from 'preact-i18n';

import { Language, LanguageSelect, useLanguageSelect } from '../components/Language';
import { SkillList, ExpandedSkillDetails } from '../components/SkillList';
import { RaceTrack, TrackSelect, RegionDisplayType } from '../components/RaceTrack';
import { TRACKNAMES_ja, TRACKNAMES_en } from '../strings/common';

import skills from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';

import { Region, RegionList } from '../uma-skill-tools/Region';
import { CourseData, CourseHelpers } from '../uma-skill-tools/CourseData';
import { HorseParameters, Strategy, Aptitude } from '../uma-skill-tools/HorseTypes';
import { getParser } from '../uma-skill-tools/ConditionParser';
import { buildSkillData, conditionsWithActivateCountsAsRandom } from '../uma-skill-tools/RaceSolverBuilder';
import { ImmediatePolicy } from '../uma-skill-tools/ActivationSamplePolicy';
import { immediate, noopImmediate } from '../uma-skill-tools/ActivationConditions';

import '../components/Tooltip.css';
import './app.css';

const DefaultCourseId = 10903;

const UI_ja = Object.freeze({
	'title': 'ウマ娘スキル発動位置可視化ツール',
	'addskill': '+ スキル追加',
	'thresholds': '補正ステータス：',
	'stats': Object.freeze(['なし', 'スピード', 'スタミナ', 'パワー', '根性', '賢さ']),
	'joiner': '、',
	'notice': Object.freeze({
		'dna': 'このコースではこのスキルは発動しない',
		'error': '発動条件を解析しながらエラーが出た'
	})
});

const UI_en = Object.freeze({
	'title': 'Umamusume Skill Activation Visualizer',
	'addskill': '+ Add Skill',
	'thresholds': 'Stat thresholds: ',
	'stats': Object.freeze(['None', 'Speed', 'Stamina', 'Power', 'Guts', 'Wisdom']),
	'joiner': ',',
	'notice': Object.freeze({
		'dna': 'This skill does not activate on this track',
		'error': 'Error parsing activation conditions'
	})
});

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
			// skills (opening leg accel skills), and other things that aren't available in a static environment like this. so instead guess approximately how far we
			// travel in t seconds by just using the course base speed.
			// this will typically be a bit high since umas need to accelerate and non-nige strategies have lower than 1.0 StrategyPhaseCoefficient for phase 0
			// except for oonige in which case it could be a bit low since their phase 0 speed is so high
			const estimate = new Region(baseSpeed(course.distance) * t, course.distance);
			return regions.rmap(r => r.intersect(estimate));
		}
	}),
	grade: noopImmediate,
	ground_condition: noopImmediate,
	is_used_skill_id: noopImmediate,
	motivation: noopImmediate,
	popularity: noopImmediate,
	running_style: noopImmediate,
	season: noopImmediate,
	time: noopImmediate,
	weather: noopImmediate
}));

const parser = getParser(conditions);

function regionsForSkill(course: CourseData, skillId: string, color: {stroke: string, fill: string}) {
	const wholeCourse = new RegionList();
	wholeCourse.push(new Region(0, course.distance));
	try {
		const sd = buildSkillData(horse, {}, course, wholeCourse, parser, skillId, true);
		if (sd == null) return {err: false, type: RegionDisplayType.Immediate, regions: [], color};
		return {
			err: false,
			type: sd.samplePolicy == ImmediatePolicy ? RegionDisplayType.Immediate : RegionDisplayType.Regions,
			regions: sd.regions,
			color,
			height: 100
		};
	} catch (e) {
		return {err: true, type: RegionDisplayType.Immediate, regions: [], color};
	}
}

function doesNotActivate(skillRegions) {
	return skillRegions.regions.length == 0 || skillRegions.regions[0].start == 9999;
}

const colors = [
	{stroke: 'rgb(205,11,11)', fill: 'rgba(247,115,115,0.3)'},
	{stroke: 'rgb(28,61,106)', fill: 'rgba(47,103,177,0.3)'},
	{stroke: 'rgb(114,76,132)', fill: 'rgba(182,153,196,0.3)'},
	{stroke: 'rgb(36,106,99)', fill: 'rgba(61,177,166,0.3)'}
];

function App(props) {
	const [language, setLanguage] = useLanguageSelect();
	const [courseId, setCourseId] = useState(() => +(/cid=(\d+)/.exec(window.location.hash) || [null, DefaultCourseId])[1]);
	const [selectedSkills, setSelectedSkills] = useState(() => new Set((/sid=(\d+(?:,\d+)*)/.exec(window.location.hash) || [null, ''])[1].split(',').filter(Boolean)));
	const [skillsOpen, setSkillsOpen] = useState(false);

	useEffect(function () {
		document.title = language == 'ja' ? UI_ja.title : UI_en.title;
	}, [language]);

	useEffect(function () {
		window.location.replace(`#cid=${courseId}${selectedSkills.size == 0 ? "" : ",sid="}${Array.from(selectedSkills).join(',')}`);
	}, [courseId, selectedSkills]);

	function setSelectedSkillsAndClose(ids) {
		setSelectedSkills(ids);
		setSkillsOpen(false);
	}
	
	function showSkillSelector(e) {
		setSkillsOpen(true);
	}
	
	function hideSkillSelector(e) {
		setSkillsOpen(false);
	}
	
	function removeSkill(e) {
		const se = e.target.closest('.expandedSkill');
		if (se == null) return;
		e.stopPropagation();
		const id = se.dataset.skillid;
		const newSelected = new Set(selectedSkills);
		newSelected.delete(id);
		setSelectedSkills(newSelected);
	}

	const strings = {skillnames: {}, tracknames: language == 'ja' ? TRACKNAMES_ja : TRACKNAMES_en, ui: language == 'ja' ? UI_ja : UI_en};
	const langid = +(language == 'en');
	Object.keys(skillnames).forEach(id => strings.skillnames[id] = skillnames[id][langid]);

	const course = CourseHelpers.getCourse(courseId);

	const statThresholds = course.courseSetStatus.length == 0 ? strings.ui.stats[0] : course.courseSetStatus.map(s => strings.ui.stats[s]).join(strings.ui.joiner);

	const regions = useMemo(() => Array.from(selectedSkills).map((id,i) => regionsForSkill(course, id, colors[i % colors.length])), [selectedSkills, course]);
	const skillDetails = useMemo(function () {
		return Array.from(selectedSkills).map(function (id, i) {
			const hasNotice = regions[i].err || doesNotActivate(regions[i]);
			return (
				<li class={`expandedSkillItem${hasNotice ? ' hasNotice' : ''}`}>
					{regions[i].err && <div class="skillNotice hasTooltip"><span>×</span><div class="tooltip"><Text id="ui.notice.error" /><span class="arrow" /></div></div>}
					{!regions[i].err && doesNotActivate(regions[i]) && <div class="skillNotice hasTooltip"><span>!</span><div class="tooltip"><Text id="ui.notice.dna" /><span class="arrow" /></div></div>}
					<div class="expandedSkillColorMarker" style={`background:${colors[i % colors.length].stroke}`} />
					<ExpandedSkillDetails id={id} distanceFactor={course.distance} />
				</li>
			);
		});
	}, [selectedSkills, course, regions]);
	
	return (
		<Language.Provider value={language}>
			<IntlProvider definition={strings}>
				<div id="overlay" class={skillsOpen ? "skillListWrapper-open" : ""} onClick={hideSkillSelector} />
				<LanguageSelect language={language} setLanguage={setLanguage} />
				<RaceTrack courseid={courseId} width="960" height="220" regions={regions} />
				<div id="buttonsRow">
					<TrackSelect courseid={courseId} setCourseid={setCourseId} />
					<div id="thresholds"><Text id="ui.thresholds" />{statThresholds}</div>
					<button id="addSkill" onClick={showSkillSelector}><Text id="ui.addskill" /></button>
				</div>
				<div id="skillDetailsWrapper" onClick={removeSkill}>
					<ul class="skillDetailsList">
						{skillDetails}
					</ul>
				</div>
				<div id="skillListWrapper" class={skillsOpen ? "skillListWrapper-open" : ""}>
					<SkillList ids={Object.keys(skills)} selected={selectedSkills} setSelected={setSelectedSkillsAndClose} />
				</div>
			</IntlProvider>
		</Language.Provider>
	);
}

render(<App lang="ja" />, document.getElementById('app'));
