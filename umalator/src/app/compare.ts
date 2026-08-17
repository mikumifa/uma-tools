import { CourseData } from "@sim/CourseData";
import { RaceParameters } from "@sim/RaceParameters";
import { RaceSolver } from "@sim/RaceSolver";
import { RaceSolverBuilder, Perspective } from "@sim/RaceSolverBuilder";

import { HorseState } from "@components/HorseDefTypes";


function interpolateByPosition(positions: number[], values: number[], position: number) {
	if (positions.length == 0 || values.length == 0) return 0;
	if (position <= positions[0]) return values[0];
	const last = Math.min(positions.length, values.length) - 1;
	if (position >= positions[last]) return values[last];

	let low = 0, high = last;
	while (low + 1 < high) {
		const middle = (low + high) >> 1;
		if (positions[middle] <= position) low = middle;
		else high = middle;
	}
	const span = positions[high] - positions[low];
	if (span <= 0) return values[low];
	const ratio = (position - positions[low]) / span;
	return values[low] + (values[high] - values[low]) * ratio;
}

function resampleTrackedSkillChart(data, trackedSkillId: string) {
	const ranges = [
		...(data.sk[0].get(trackedSkillId) || []),
		...(data.sk[1].get(trackedSkillId) || []),
	]
		.map(([start, end]) => ({start, end}))
		.filter(({start, end}) => Number.isFinite(start) && Number.isFinite(end) && end > start);
	if (ranges.length == 0) return;

	// The two solvers are sampled at fixed time steps, so once one horse moves
	// ahead their raw points no longer represent exactly the same course
	// positions. Resample both trajectories onto one position axis for a fair
	// visual comparison, while preserving each solver's real post-skill speed.
	const original = {
		p: [data.p[0].slice(), data.p[1].slice()],
		v: [data.v[0].slice(), data.v[1].slice()],
		t: [data.t[0].slice(), data.t[1].slice()],
		hp: [data.hp[0].slice(), data.hp[1].slice()],
	};
	const baselineEnd = original.p[0][original.p[0].length - 1];
	const positions = Array.from(new Set([
		...original.p[0],
		...original.p[1],
		...ranges.flatMap(({start, end}) => [start, end]),
	]))
		.filter(position => Number.isFinite(position) && position >= 0 && position <= baselineEnd)
		.sort((a, b) => a - b);
	const baselineSpeed = positions.map(position =>
		interpolateByPosition(original.p[0], original.v[0], position)
	);
	const comparedSpeed = positions.map(position =>
		interpolateByPosition(original.p[1], original.v[1], position)
	);

	data.p = [positions, positions];
	data.v = [baselineSpeed, comparedSpeed];
	data.t = original.t.map((values, index) => positions.map(position =>
		interpolateByPosition(original.p[index], values, position)
	));
	data.hp = original.hp.map((values, index) => positions.map(position =>
		interpolateByPosition(original.p[index], values, position)
	));
}



export function runComparison(nsamples: number, course: CourseData, racedef: RaceParameters, uma1: HorseState, uma2: HorseState, options) {
	const standard = new RaceSolverBuilder(nsamples)
		.seed(options.seed)
		.course(course)
		.mood(racedef.mood)
		.ground(racedef.groundCondition)
		.weather(racedef.weather)
		.season(racedef.season)
		.time(racedef.time);
	if (racedef.orderRange != null) {
		standard
			.order(racedef.orderRange[0], racedef.orderRange[1])
			.numUmas(racedef.numUmas);
	}
	const compare = standard.fork();
	standard.horse(uma1.toJS());
	compare.horse(uma2.toJS());
	// ensure skills common to the two umas are added in the same order regardless of what additional skills they have
	// this is important to make sure the rng for their activations is synced
	const common = uma1.skills.intersect(uma2.skills).toArray().sort((a,b) => +a - +b);
	const commonIdx = (id) => { let i = common.indexOf(id); return i > -1 ? i : common.length; };
	const sort = (a,b) => commonIdx(a) - commonIdx(b) || +a - +b;
	uma1.skills.toArray().sort(sort).forEach(id => {
		standard.addSkill(id.split('-')[0], Perspective.Self);
		compare.addSkill(id.split('-')[0], Perspective.Other);
	});
	uma2.skills.toArray().sort(sort).forEach(id => {
		compare.addSkill(id.split('-')[0], Perspective.Self);
		standard.addSkill(id.split('-')[0], Perspective.Other);
	});
	standard.withAsiwotameru().withStaminaSyoubu();
	compare.withAsiwotameru().withStaminaSyoubu();
	if (options.usePosKeep) {
		standard.useDefaultPacer(); compare.useDefaultPacer();
	}
	const skillPos1 = {self: new Map(), other: new Map()};
	const skillPos2 = {self: new Map(), other: new Map()};
	const trackedSkillId = options.trackSkillId;
	const trackedBaseSkillId = trackedSkillId?.split('-')[0];
	const sampleRuns = trackedSkillId ? [] : null;
	const activationTriggerRanges = trackedSkillId ? new Map() : null;
	function getSkillPositionSet(source, perspective) {
		return perspective == Perspective.Self ? source.self : source.other;
	}
	function getActivator(selfSource, otherSource) {
		return function (s, id, persp) {
			const source = persp == Perspective.Self ? selfSource : otherSource;
			const skillSet = getSkillPositionSet(source, persp);
			if (id != 'asitame' && id != 'staminasyoubu') {
				if (!skillSet.has(id)) skillSet.set(id, []);
				skillSet.get(id).push([s.pos, 0]);
			}
		};
	}
	function getDeactivator(selfSource, otherSource) {
		return function (s, id, persp) {
			const source = persp == Perspective.Self ? selfSource : otherSource;
			const skillSet = getSkillPositionSet(source, persp);
			if (id != 'asitame' && id != 'staminasyoubu') {
				const ar = skillSet.get(id);  // activation record
				// assume the first activation of a skill ends before the second one starts
				// don't think there's any way around this but it should always be true
				ar[ar.length-1][1] = Math.min(s.pos, course.distance);
			}
		};
	}
	function mergeSkillPositions(source) {
		// A skill can be built once for its self-target effects and once for its
		// opponent-target effects. They are two perspectives of the same source
		// activation, so expose one lane record per source skill. Prefer the
		// owner's self-perspective timing, falling back to the opponent
		// perspective for pure debuffs.
		const merged = new Map(source.other);
		source.self.forEach((activations, id) => merged.set(id, activations));
		return merged;
	}
	function clearSkillPositions(source) {
		source.self.clear();
		source.other.clear();
	}
	standard.onSkillActivate(getActivator(skillPos1, skillPos2));
	standard.onSkillDeactivate(getDeactivator(skillPos1, skillPos2));
	compare.onSkillActivate(getActivator(skillPos2, skillPos1));
	compare.onSkillDeactivate(getDeactivator(skillPos2, skillPos1));
	let a = standard.build(), b = compare.build();
	let ai = 1, bi = 0;
	let sign = 1;
	const diff = [];
	let min = Infinity, max = -Infinity, estMean, estMedian, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
	let minrun, maxrun, meanrun, medianrun;
	const sampleCutoff = Math.max(Math.floor(nsamples * 0.8), nsamples - 200);
	let retry = false;
	for (let i = 0; i < nsamples; ++i) {
		const s1 = a.next(retry).value as RaceSolver;
		const s2 = b.next(retry).value as RaceSolver;
		const scheduledRanges = trackedSkillId
			? [...s1.pendingSkills, ...s2.pendingSkills]
				.filter(skill =>
					skill.skillId == trackedBaseSkillId &&
					skill.perspective == Perspective.Self &&
					skill.trigger != null
				)
				.flatMap(skill =>
					(skill.randomActivationRegions?.length
						? skill.randomActivationRegions
						: [skill.trigger]
					).map(region => ({
						start: Math.max(0, region.start),
						end: Math.min(course.distance, region.end),
					}))
				)
				.filter(range => range.end > range.start && range.start < course.distance)
			: [];
		const data = {t: [[], []], p: [[], []], v: [[], []], hp: [[], []], sk: [null,null], sdly: [0,0]};

		while (s2.pos < course.distance) {
			s2.step(1/15);
			data.t[ai].push(s2.accumulatetime.t);
			data.p[ai].push(s2.pos);
			data.v[ai].push(s2.currentSpeed + (s2.modifiers.currentSpeed.acc + s2.modifiers.currentSpeed.err));
			data.hp[ai].push((s2.hp as GameHpPolicy).hp);
		}
		data.sdly[ai] = s2.startDelay;

		while (s1.accumulatetime.t < s2.accumulatetime.t) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		// run the rest of the way to have data for the chart
		const pos1 = s1.pos;
		while (s1.pos < course.distance) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		data.sdly[bi] = s1.startDelay;

		s2.cleanup();
		s1.cleanup();

		data.sk[1] = mergeSkillPositions(skillPos2);  // NOT ai (NB. why not?)
		clearSkillPositions(skillPos2);
		data.sk[0] = mergeSkillPositions(skillPos1);  // NOT bi (NB. why not?)
		clearSkillPositions(skillPos1);

		// if `standard` is faster than `compare` then the former ends up going past the course distance
		// this is not in itself a problem, but it would overestimate the difference if for example a skill
		// continues past the end of the course. i feel like there are probably some other situations where it would
		// be inaccurate also. if this happens we have to swap them around and run it again.
		if (s2.pos < pos1) {
			[b,a] = [a,b];
			[bi,ai] = [ai,bi];
			sign *= -1;
			--i;  // this one didnt count
			retry = true;
		} else {
			retry = false;
			if (activationTriggerRanges) {
				scheduledRanges.forEach(range => {
					activationTriggerRanges.set(`${range.start}:${range.end}`, range);
				});
			}
			const basinn = sign * (s2.pos - pos1) / 2.5;
			diff.push(basinn);
			let chartResampled = false;
			const resampleChart = () => {
				if (!chartResampled && trackedBaseSkillId) {
					resampleTrackedSkillChart(data, trackedBaseSkillId);
					chartResampled = true;
				}
			};
			if (sampleRuns) {
				const ranges = [
					...(data.sk[0].get(trackedBaseSkillId) || []),
					...(data.sk[1].get(trackedBaseSkillId) || []),
				].map(([start, end]) => ({start, end}));
				sampleRuns.push({value: basinn, ranges});
			}
			if (basinn < min) {
				min = basinn;
				resampleChart();
				minrun = data;
			}
			if (basinn > max) {
				max = basinn;
				resampleChart();
				maxrun = data;
			}
			if (i == sampleCutoff) {
				diff.sort((a,b) => a - b);
				estMean = diff.reduce((a,b) => a + b) / diff.length;
				const mid = Math.floor(diff.length / 2);
				estMedian = mid > 0 && diff.length % 2 == 0 ? (diff[mid-1] + diff[mid]) / 2 : diff[mid];
			}
			if (i >= sampleCutoff) {
				const meanDiff = Math.abs(basinn - estMean), medianDiff = Math.abs(basinn - estMedian);
				if (meanDiff < bestMeanDiff) {
					bestMeanDiff = meanDiff;
					resampleChart();
					meanrun = data;
				}
				if (medianDiff < bestMedianDiff) {
					bestMedianDiff = medianDiff;
					resampleChart();
					medianrun = data;
				}
			}
		}
	}
	diff.sort((a,b) => a - b);
	if (sampleRuns) sampleRuns.sort((a,b) => a.value - b.value);
	return {
		results: diff,
		runData: {minrun, maxrun, meanrun, medianrun},
		sampleRuns,
		activationTriggerRanges: activationTriggerRanges
			? Array.from(activationTriggerRanges.values()).sort((a,b) => a.start - b.start || a.end - b.end)
			: [],
	};
}
