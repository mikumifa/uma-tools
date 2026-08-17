import { h, Fragment } from "preact";
import { useState, useMemo, useId, useEffect } from "preact/hooks";
import { Text, Localizer } from "preact-i18n";

// 移除 @tanstack/table-core 的所有引用

import { Region, RegionList } from "@sim/Region";
import { CourseData } from "@sim/CourseData";
import { RaceParameters } from "@sim/RaceParameters";
import { getParser } from "@sim/ConditionParser";
import {
  buildBaseStats,
  buildSkillData,
  Perspective,
} from "@sim/RaceSolverBuilder";

import type { HorseState } from "@components/HorseDef";
// import { runComparison } from "./compare"; // 如果没用到可以注释掉

import "./BasinnChart.css";

import skillnames from "@data/skillnames.json";
import skill_meta from "@data/skill_meta.json";

function skillmeta(id: string) {
  return skill_meta[id.split("-")[0]];
}

const ICON_BASE = `${import.meta.env.BASE_URL}icons`;

export function getActivateableSkills(
  skills: string[],
  horse: HorseState,
  course: CourseData,
  racedef: RaceParameters
) {
  const parser = getParser();
  const h2 = buildBaseStats(horse, racedef.mood);
  const wholeCourse = new RegionList();
  wholeCourse.push(new Region(0, course.distance));
  return skills.filter((id) => {
    let sd;
    try {
      sd = buildSkillData(
        h2,
        racedef,
        course,
        wholeCourse,
        parser,
        id,
        Perspective.Any
      );
    } catch (_) {
      return false;
    }
    return sd.some(
      (trigger) => trigger.regions.length > 0 && trigger.regions[0].start < 9999
    );
  });
}

export function getNullRow(skillid: string) {
  return {
    id: skillid,
    min: 0,
    max: 0,
    mean: 0,
    median: 0,
    results: [],
    runData: null,
  };
}

// 修改：直接接收 value 而不是 cell context
function formatBasinn(value) {
  if (typeof value !== "number" || isNaN(value)) {
    return "0.00 L";
  }
  return value.toFixed(2).replace("-0.00", "0.00") + " L";
}

function SkillNameCell({ id }) {
  return (
    <div className="chartSkillName">
      <img src={`${ICON_BASE}/${skillmeta(id).iconId}.png`} />
      <span>
        <Text id={`skillnames.${id}`} />
      </span>
    </div>
  );
}

export function BasinnChart(props) {
  const radioGroup = useId();
  const [selected, setSelected] = useState("");
  const [selectedType, setSelectedType] = useState("mean");
  const compact = Boolean(props.compact);
  const activeId = props.selectedId || selected;
  // Keep the compact two-column mode for mobile; the widened desktop sidebar can fit all metrics.
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 900 : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 手动管理排序状态： { key: string, direction: 'asc' | 'desc' }
  const [sortConfig, setSortConfig] = useState({
    key: "mean",
    direction: "desc",
  });

  function headerClick(type) {
    setSelectedType(type);
    props.onRunTypeChange(type + "run");
  }

  // 处理排序点击
  function handleSort(key, defaultDesc = false) {
    setSortConfig((prev) => {
      // 如果点击的是当前排序列，则反转方向
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // 如果是新列，使用该列的默认排序方向（数值通常默认降序，名称默认升序）
      return { key, direction: defaultDesc ? "desc" : "asc" };
    });
  }

  // 核心逻辑：替代 useTable 的数据处理
  const sortedData = useMemo(() => {
    // 浅拷贝数据以避免修改原数组
    let sortableData = [...props.data];

    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        const key = sortConfig.key;
        let valA = a[key];
        let valB = b[key];

        // 特殊处理：技能名称排序
        if (key === "id") {
          // 使用 skillnames 映射表进行比较
          valA = skillnames[valA] || valA;
          valB = skillnames[valB] || valB;

          if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
          if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }

        // 通用数值排序
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableData;
  }, [props.data, sortConfig]);

  // 定义列配置，替代 TanStack 的 columns 定义
  // 这里直接定义结构，不再需要 accessorKey 等复杂配置
  const columns = [
    {
      key: "id",
      header: () => <span>技能名</span>,
      cell: (row) => <SkillNameCell id={row.id} />,
      sortable: true,
      defaultDesc: false,
    },
    {
      key: "min",
      label: "最小", // 用于 Radio 的 label
      radioType: "min", // 用于 Radio 的 value
      cell: (row) => formatBasinn(row.min),
      sortable: true,
      defaultDesc: false,
    },
    {
      key: "max",
      label: "最大",
      radioType: "max",
      cell: (row) => formatBasinn(row.max),
      sortable: true,
      defaultDesc: false,
    },
    {
      key: "mean",
      label: "平均",
      radioType: "mean",
      cell: (row) => formatBasinn(row.mean),
      sortable: true,
      defaultDesc: true, // 平均值默认降序
    },
    {
      key: "median",
      label: "中位",
      radioType: "median",
      cell: (row) => formatBasinn(row.median),
      sortable: true,
      defaultDesc: false,
    },
  ];

  function handleClick(e) {
    const tr = e.target.closest("tr");
    if (tr == null) return;
    e.stopPropagation();
    const id = tr.dataset.skillid;
    if (e.target.tagName === "IMG") {
      props.onInfoClick(id);
    } else {
      setSelected(id);
      props.onSelectionChange(id);
    }
  }

  function handleDblClick(e) {
    const tr = e.target.closest("tr");
    if (tr == null) return;
    e.stopPropagation();
    const id = tr.dataset.skillid;
    props.onDblClickRow(id);
  }

  function handleMouseMove(e) {
    const tr = e.target.closest("tr[data-skillid]");
    if (tr == null) return;
    props.onSkillHover?.(tr.dataset.skillid, {
      x: e.clientX,
      y: e.clientY,
    });
  }

  // 辅助函数：渲染带 Radio 的表头
  const renderRadioHeader = (col) => {
    const clickRadio = (e) => {
      e.stopPropagation();
      headerClick(col.radioType);
    };

    return (
      <div>
        <input
          type="radio"
          name={radioGroup}
          checked={selectedType === col.radioType}
          title={`Show ${col.label.toLowerCase()} on chart`}
          onClick={clickRadio}
        />
        <span onClick={() => handleSort(col.key, col.defaultDesc)}>
          {col.label}
        </span>
      </div>
    );
  };

  const visibleColumns = useMemo(() => {
    if (!isMobile && !compact) return columns;
    return columns.filter(
      (c) => c.key === "id" || c.radioType === selectedType
    );
  }, [columns, compact, isMobile, selectedType]);
  const runOptions = [
    { key: "min", label: "最小" },
    { key: "max", label: "最大" },
    { key: "mean", label: "平均" },
    { key: "median", label: "中位" },
  ];

  return (
    <div
      class={`basinnChartWrapper ${compact ? "compact" : ""} ${isMobile ? "mobile" : ""}`}
    >
      <table class="basinnChart">
        <thead>
          {(isMobile || compact) && (
            <tr className="mobileRunToggleRow">
              <th colSpan={visibleColumns.length}>
                <div className="mobileRunToggle">
                  <span className="mobileRunToggleLabel">显示</span>
                  <div className="mobileRunToggleButtons">
                    {runOptions.map((opt) => (
                      <button
                        type="button"
                        className={`mobileRunToggleBtn ${
                          selectedType === opt.key ? "active" : ""
                        }`}
                        onClick={() => headerClick(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </th>
            </tr>
          )}
          <tr>
            {visibleColumns.map((col) => {
              // 计算当前的排序状态 class
              const isSorted = sortConfig.key === col.key;
              const sortClass = isSorted
                ? sortConfig.direction === "asc"
                  ? "basinnChartSortedAsc"
                  : "basinnChartSortedDesc"
                : "";

              return (
                <th key={col.key}>
                  <div
                    class={`columnHeader ${sortClass}`}
                    title={
                      col.sortable
                        ? isSorted
                          ? sortConfig.direction === "asc"
                            ? "Sort descending"
                            : "Sort ascending"
                          : "Sort"
                        : ""
                    }
                  >
                    {/* 根据列定义渲染内容：如果是技能名则是普通Header，其他是RadioHeader */}
                    {col.key === "id" ? (
                      <span
                        onClick={() => handleSort(col.key, col.defaultDesc)}
                      >
                        {col.header()}
                      </span>
                    ) : (
                      renderRadioHeader(col)
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody
          onClick={handleClick}
          onDblClick={handleDblClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => props.onSkillHover?.(null)}
        >
          {sortedData.map((row) => {
            const id = row.id;
            // 处理隐藏行
            if (props.hidden && props.hidden.has(id)) return null;

            return (
              <tr
                key={id}
                data-skillid={id}
                class={id === activeId ? "selected" : ""}
              >
                {visibleColumns.map((col) => (
                  <td key={`${id}-${col.key}`}>{col.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
