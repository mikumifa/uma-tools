import { h, Fragment } from "preact";
import { useState, useMemo, useEffect, useRef } from "preact/hooks";
import { IntlProvider, Text, Localizer } from "preact-i18n";
import { Set as ImmSet } from "immutable";

import {
  SkillList,
  Skill,
  ExpandedSkillDetails,
} from "./SkillList";

import { HorseParameters } from "@sim/HorseTypes";

import { SkillSet, HorseState } from "./HorseDefTypes";

import "./HorseDef.css";

import umas from "@data/umas.json";
import icons from "@data/icon_paths.json";
import skills from "@data/skill_data.json";
import { createPortal } from "preact/compat";

function skilldata(id: string) {
  return skills[id.split("-")[0]];
}

const ICON_BASE = `${import.meta.env.BASE_URL}icons`;
const iconUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${path
    .replace(/^[\\/]/, "")
    .replace(/^uma-tools\//, "")}`;

const umaAltIds = Object.keys(umas).flatMap((id) =>
  Object.keys(umas[id].outfits)
);
const umaNamesForSearch = {};
umaAltIds.forEach((id) => {
  const u = umas[id.slice(0, 4)];
  umaNamesForSearch[id] = (u.outfits[id] + " " + u.name[0])
    .toUpperCase()
    .replace(/\./g, "");
});

function searchNames(query) {
  const q = query.toUpperCase().replace(/\./g, "");
  return umaAltIds.filter((oid) => umaNamesForSearch[oid].indexOf(q) > -1);
}

export function UmaSelector(props) {
  const randomMob = useMemo(
    () =>
      iconUrl(
        `icons/mob/trained_mob_chr_icon_${
          8000 + Math.floor(Math.random() * 624)
        }_000001_01.png`
      ),
    []
  );
  const u = props.value && umas[props.value.slice(0, 4)];
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const outfitName = props.value && u ? u.outfits[props.value] : "";
  const umaName = u ? u.name[0] : "";
  const suggestions = useMemo(
    () => (query.trim().length > 0 ? searchNames(query) : umaAltIds),
    [query]
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  function confirm(oid) {
    setOpen(false);
    props.select(oid);
  }

  return (
    <div class="umaSelector">
      <button
        type="button"
        class="umaSelectedButton"
        tabindex={props.tabindex}
        onClick={() => setOpen(true)}
      >
        <span class="umaSelectorIconsBox">
          <img src={props.value ? iconUrl(icons[props.value]) : randomMob} />
        </span>
        <span class="umaSelectedText">
          <strong>{umaName || "选择马娘"}</strong>
          <span>{outfitName || "点击搜索角色和衣装"}</span>
        </span>
      </button>
      {open &&
        <div class="umaPickerPanel">
          <div class="umaPickerHeader">
            <input
              type="search"
              class="umaPickerSearch"
              placeholder="搜索马娘 / 衣装"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              ref={input}
            />
            <button
              type="button"
              class="umaPickerClose"
              title="关闭"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div class="umaPickerList">
            {suggestions.map((oid) => {
              const uid = oid.slice(0, 4);
              return (
                <button
                  key={oid}
                  type="button"
                  class={`umaPickerItem ${oid === props.value ? "selected" : ""}`}
                  onClick={() => confirm(oid)}
                >
                  <img src={iconUrl(icons[oid])} />
                  <span>
                    <strong>{umas[uid].name[0]}</strong>
                    <small>{umas[uid].outfits[oid]}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>}
    </div>
  );
}

export function Stat(props) {
  const handleInput = (e) => {
    const value = e.currentTarget.value.replace(/\D/g, "");
    props.change(value === "" ? 0 : Math.min(2000, +value));
  };

  return (
    <div class="horseParam">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={props.value}
        tabindex={props.tabindex}
        onInput={handleInput}
      />
    </div>
  );
}

const APTITUDES = Object.freeze(["S", "A", "B", "C", "D", "E", "F", "G"]);
export function AptitudeIcon(props) {
  const idx = 7 - APTITUDES.indexOf(props.a);
  return (
    <img
      className="
        h-[14px]
        w-auto
        inline-block
        align-middle
      "
      src={`${ICON_BASE}/utx_ico_statusrank_${(100 + idx)
        .toString()
        .slice(1)}.png`}
    />
  );
}

export function AptitudeSelect(props) {
  const [open, setOpen] = useState(false);

  function setAptitude(e) {
    e.preventDefault();
    e.stopPropagation();
    props.setA(e.currentTarget.dataset.horseAptitude);
    setOpen(false);
  }

  return (
    <div
      tabIndex={props.tabindex}
      onClick={() => setOpen((v) => !v)}
      onBlur={() => setOpen(false)}
      className="
        absolute right-2 top-1/2 -translate-y-1/2
        inline-block
        z-20
        cursor-pointer
        select-none
        outline-none
      "
    >
      {/* 当前 Aptitude + 箭头 */}
      <span className="relative inline-flex items-center">
        <AptitudeIcon a={props.a} />

        {/* ▼ 箭头 */}
        <i
          className="
            absolute
            right-[-6px] bottom-[-2px]
            w-1 h-1
            border-r border-b
            border-[rgb(121,64,22)]
            rotate-45
          "
        />
      </span>

      {/* 下拉列表 */}
      <ul
        className={`
    absolute right-[-12px] top-[10px]
    z-30
    w-[24px]
    rounded-sm
    border border-[rgb(224,214,204)]
    bg-white
    shadow-sm
    ${open ? "block" : "hidden"}
  `}
      >
        {APTITUDES.map((a) => (
          <li
            key={a}
            data-horse-aptitude={a}
            onMouseDown={setAptitude}
            className="
        flex items-center justify-center
        h-[18px]
        hover:bg-[rgb(245,238,230)]
      "
          >
            <AptitudeIcon a={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StrategySelect(props) {
  return (
    <select
      class="horseStrategySelect"
      value={props.s}
      tabindex={props.tabindex}
      onInput={(e) => props.setS(e.currentTarget.value)}
    >
      <option value="Nige">领跑</option>
      <option value="Senkou">前列</option>
      <option value="Sasi">居中</option>
      <option value="Oikomi">后追</option>
      <option value="Oonige">大逃</option>
    </select>
  );
}

export function AptitudeOptionSelect(props) {
  return (
    <select
      class="horseStrategySelect"
      value={props.a}
      tabindex={props.tabindex}
      onInput={(e) => props.setA(e.currentTarget.value)}
    >
      {APTITUDES.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

const nonUniqueSkills = Object.keys(skills).filter(
  (id) => skilldata(id).rarity < 3 || skilldata(id).rarity > 5
);

function assertIsSkill(sid: string): asserts sid is keyof typeof skills {
  console.assert(skilldata(sid) != null, `skilldata is null for sid: ${sid}`);
}

function uniqueSkillForUma(
  oid: (typeof umaAltIds)[number]
): keyof typeof skills {
  const i = +oid.slice(1, -2),
    v = +oid.slice(-2);
  const sid = (100000 + 10000 * (v - 1) + i * 10 + 1).toString();
  assertIsSkill(sid);
  return sid;
}

let totalTabs = 0;
export function horseDefTabs() {
  return totalTabs;
}

export function HorseDef(props) {
  const { state, setState } = props;
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => ImmSet());

  const tabstart = props.tabstart();
  let tabi = 0;
  function tabnext() {
    if (++tabi > totalTabs) totalTabs = tabi;
    return tabstart + tabi - 1;
  }

  const umaId = state.outfitId;
  const selectableSkills = useMemo(
    () =>
      nonUniqueSkills.filter(
        (id) => skilldata(id).rarity != 6 || id.startsWith(umaId)
      ),
    [umaId]
  );

  function setter(prop: keyof HorseState) {
    return (x) => setState(state.set(prop, x));
  }
  const setSkills = setter("skills");

  function setUma(id) {
    let newSkills = state.skills.filter((id) => skilldata(id).rarity < 3);
    if (id) newSkills = newSkills.add(uniqueSkillForUma(id));
    setState(state.set("outfitId", id).set("skills", newSkills));
  }

  function openSkillPicker(e) {
    e.stopPropagation();
    setSkillPickerOpen(true);
  }

  function setSkillsAndClose(ids) {
    setSkills(SkillSet(ids));
    setSkillPickerOpen(false);
  }

  function handleSkillClick(e) {
    e.stopPropagation();
    const se = e.target.closest(".skill, .expandedSkill");
    if (se == null) return;
    if (e.target.classList.contains("skillDismiss")) {
      setSkills(state.skills.delete(se.dataset.skillid));
    } else if (se.classList.contains("expandedSkill")) {
      setExpanded(expanded.delete(se.dataset.skillid));
    } else {
      setExpanded(expanded.add(se.dataset.skillid));
    }
  }

  useEffect(
    function () {
      window.requestAnimationFrame(() =>
        document.querySelectorAll(".horseExpandedSkill").forEach((e) => {
          (e as HTMLElement).style.gridRow =
            "span " +
            Math.ceil((e.firstChild as HTMLElement).offsetHeight / 64);
        })
      );
    },
    [expanded]
  );

  return (
    <div class="horseDef">
      <div class="horseDefHeader">{props.children}</div>
      <UmaSelector value={umaId} select={setUma} tabindex={tabnext()} />
      <div class="horseParams">
        <div class="horseParamHeader">
          <span>速度</span>
        </div>
        <div class="horseParamHeader">
          <span>耐力</span>
        </div>
        <div class="horseParamHeader">
          <span>力量</span>
        </div>
        <div class="horseParamHeader">
          <span>根性</span>
        </div>
        <div class="horseParamHeader">
          <span>智力</span>
        </div>
        <Stat
          value={state.speed}
          change={setter("speed")}
          tabindex={tabnext()}
        />
        <Stat
          value={state.stamina}
          change={setter("stamina")}
          tabindex={tabnext()}
        />
        <Stat
          value={state.power}
          change={setter("power")}
          tabindex={tabnext()}
        />
        <Stat value={state.guts} change={setter("guts")} tabindex={tabnext()} />
        <Stat
          value={state.wisdom}
          change={setter("wisdom")}
          tabindex={tabnext()}
        />
      </div>
      <div class="horseAptitudes">
        <div>
          <span>场地适应性</span>
          <AptitudeOptionSelect
            a={state.surfaceAptitude}
            setA={setter("surfaceAptitude")}
            tabindex={tabnext()}
          />
        </div>
        <div>
          <span>距离适应性</span>
          <AptitudeOptionSelect
            a={state.distanceAptitude}
            setA={setter("distanceAptitude")}
            tabindex={tabnext()}
          />
        </div>
        <div>
          <span>跑法选择</span>
          <StrategySelect
            s={state.strategy}
            setS={setter("strategy")}
            tabindex={tabnext()}
          />
        </div>
        <div>
          <span>跑法适应性</span>
          <AptitudeOptionSelect
            a={state.strategyAptitude}
            setA={setter("strategyAptitude")}
            tabindex={tabnext()}
          />
        </div>
      </div>
      <div class="horseSkillHeader">Skills</div>
      <div class="horseSkillListWrapper" onClick={handleSkillClick}>
        <ul class="horseSkillList animate-skilllist">
          {Array.from(state.skills).map((id) => {
            const u = uniqueSkillForUma(umaId);
            return (
              <li key={id} class="skill-item fade-in">
                {expanded.has(id) ? (
                  <ExpandedSkillDetails
                    id={id}
                    distanceFactor={props.courseDistance}
                    dismissable={id != u}
                  />
                ) : (
                  <Skill id={id} selected={false} dismissable={id != u} />
                )}
              </li>
            );
          })}
          <li key="add">
            <div
              class="skill addSkillButton"
              onClick={openSkillPicker}
              tabindex={tabnext()}
            >
              <span>+</span>添加技能
            </div>
          </li>
        </ul>
      </div>
      <div
        class={`horseSkillPickerOverlay ${skillPickerOpen ? "open" : ""}`}
        onClick={setSkillPickerOpen.bind(null, false)}
      />
      <div class={`horseSkillPickerWrapper ${skillPickerOpen ? "open" : ""}`}>
        {skillPickerOpen &&
          createPortal(
            <SkillList
              ids={selectableSkills}
              selected={new Set(state.skills)}
              setSelected={setSkillsAndClose}
              isOpen={skillPickerOpen}
            />,
            document.body
          )}
      </div>
    </div>
  );
}
