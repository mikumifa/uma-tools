import type { CourseData } from "@sim/CourseData";
import type { RaceParameters } from "@sim/RaceParameters";

import { HorseState, SkillSet } from "@components/HorseDefTypes";
import { runComparison } from "./compare";

function mergeResults(results1, results2) {
  console.assert(
    results1.id == results2.id,
    `mergeResults: ${results1.id} != ${results2.id}`
  );
  const n1 = results1.results.length,
    n2 = results2.results.length;
  const combinedResults = results1.results
    .concat(results2.results)
    .sort((a, b) => a - b);
  const sampleRuns = (results1.sampleRuns || [])
    .concat(results2.sampleRuns || [])
    .sort((a, b) => a.value - b.value);
  const combinedMean = (results1.mean * n1 + results2.mean * n2) / (n1 + n2);
  const mid = Math.floor(combinedResults.length / 2);
  const newMedian =
    combinedResults.length % 2 == 0
      ? (combinedResults[mid - 1] + combinedResults[mid]) / 2
      : combinedResults[mid];
  return {
    id: results1.id,
    results: combinedResults,
    min: Math.min(results1.min, results2.min),
    max: Math.max(results1.max, results2.max),
    mean: combinedMean,
    median: newMedian,
    sampleRuns,
    possibleActivationRanges: dedupeActivationRanges(
      results1.possibleActivationRanges,
      results2.possibleActivationRanges,
    ),
    runData: {
      // TODO should re-compute the bashin gain from .t/.p and pick whichever is closer to new mean/median
      ...(n2 > n1 ? results2.runData : results1.runData),
      minrun:
        results1.min < results2.min
          ? results1.runData.minrun
          : results2.runData.minrun,
      maxrun:
        results1.max > results2.max
          ? results1.runData.maxrun
          : results2.runData.maxrun,
    },
  };
}

function run1Skill(
  nsamples: number,
  id: string,
  course: CourseData,
  racedef: RaceParameters,
  uma,
  options
) {
  const withSkill = uma.set("skills", uma.skills.add(id));
  const {
    results,
    runData,
    sampleRuns = [],
    activationTriggerRanges = [],
  } = runComparison(
    nsamples,
    course,
    racedef,
    uma,
    withSkill,
    { ...options, trackSkillId: id }
  );
  const mid = Math.floor(results.length / 2);
  const median =
    results.length % 2 == 0
      ? (results[mid - 1] + results[mid]) / 2
      : results[mid];
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  return {
    id,
    results,
    runData,
    sampleRuns,
    possibleActivationRanges: activationTriggerRanges,
    min: results[0],
    max: results[results.length - 1],
    mean,
    median,
  };
}

function dedupeActivationRanges(...rangeLists) {
  const ranges = new Map();
  rangeLists.flat().forEach((range) => {
    if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
      return;
    }
    ranges.set(`${range.start}:${range.end}`, range);
  });
  return Array.from(ranges.values()).sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
}

function runChartStage({
  runId,
  stage,
  nsamples,
  skills,
  course,
  racedef,
  uma,
  options,
  results,
  startPercent,
  endPercent,
}) {
  const total = skills.length;
  const updated = new Map();
  let lastPost = 0;

  if (total === 0) {
    postMessage({
      type: "progress",
      runId,
      stage,
      percent: endPercent,
      done: 0,
      total: 0,
    });
    return results;
  }

  skills.forEach((id, index) => {
    const row = run1Skill(nsamples, id, course, racedef, uma, options);
    if (results.has(id)) {
      results.set(id, mergeResults(results.get(id), row));
    } else {
      results.set(id, row);
    }
    updated.set(id, results.get(id));

    const done = index + 1;
    const percent = Math.round(
      startPercent + ((endPercent - startPercent) * done) / total
    );
    const now = Date.now();
    if (updated.size >= 8 || now - lastPost > 160 || done === total) {
      postMessage({ type: "chart", runId, results: new Map(updated) });
      postMessage({ type: "progress", runId, stage, percent, done, total });
      updated.clear();
      lastPost = now;
    }
  });

  return results;
}

function runChart({ runId, skills, course, racedef, uma, options }) {
  const uma_ = new HorseState(uma).set("skills", SkillSet(uma.skills));
  let results = new Map();
  results = runChartStage({
    runId,
    stage: "初筛技能",
    nsamples: 5,
    skills,
    course,
    racedef,
    uma: uma_,
    options,
    results,
    startPercent: 0,
    endPercent: 12,
  });

  skills = skills.filter((id) => results.get(id).max > 0.1);
  results = runChartStage({
    runId,
    stage: "稳定估算",
    nsamples: 20,
    skills,
    course,
    racedef,
    uma: uma_,
    options,
    results,
    startPercent: 12,
    endPercent: 35,
  });

  skills = skills.filter(
    (id) => Math.abs(results.get(id).max - results.get(id).min) > 0.1
  );
  results = runChartStage({
    runId,
    stage: "精化分布",
    nsamples: 50,
    skills,
    course,
    racedef,
    uma: uma_,
    options,
    results,
    startPercent: 35,
    endPercent: 65,
  });

  results = runChartStage({
    runId,
    stage: "最终采样",
    nsamples: 200,
    skills,
    course,
    racedef,
    uma: uma_,
    options,
    results,
    startPercent: 65,
    endPercent: 98,
  });

  postMessage({ type: "chart", runId, results }); // 最终结果
  postMessage({ type: "progress", runId, stage: "完成", percent: 100 });
}

function runCompare({ runId, nsamples, course, racedef, uma1, uma2, options }) {
  const uma1_ = new HorseState(uma1).set("skills", SkillSet(uma1.skills));
  const uma2_ = new HorseState(uma2).set("skills", SkillSet(uma2.skills));
  let results;
  let step = 0;
  for (
    let n = Math.min(20, nsamples), mul = 6;
    n < nsamples;
    n = Math.min(n * mul, nsamples), mul = Math.max(mul - 1, 2)
  ) {
    step++;
    results = runComparison(n, course, racedef, uma1_, uma2_, options);
    postMessage({ type: "compare", runId, results });
  }
  results = runComparison(nsamples, course, racedef, uma1_, uma2_, options);
  postMessage({ type: "compare", runId, results });
  postMessage({
    type: "progress",
    runId,
    stage: "完成",
    percent: 100,
  });
}

self.addEventListener("message", function (e) {
  const { msg, data } = e.data;
  switch (msg) {
    case "chart":
      runChart(data);
      break;
    case "compare":
      runCompare(data);
      break;
  }
});
