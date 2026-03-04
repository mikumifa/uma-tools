import { h, Fragment } from "preact";
import { useState, useReducer, useMemo, useEffect, useRef } from "preact/hooks";
import { IntlProvider, Text, Localizer } from "preact-i18n";
import { Set as ImmSet } from "immutable";

import {
  SkillList,
  Skill,
  ExpandedSkillDetails,
} from "../components/SkillList";

import { HorseParameters } from "../uma-skill-tools/HorseTypes";

import { SkillSet, HorseState } from "./HorseDefTypes";

import "./HorseDef.css";

import umas from "../umalator/data/umas.json";
import icons from "../icons.json";
import skills from "../umalator/data/skill_data.json";
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
  const suggestionsContainer = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  function update(q) {
    return { input: q, suggestions: searchNames(q) };
  }
  const [query, search] = useReducer(
    (_, q) => update(q),
    u && u.name[0],
    update
  );
  const selectedUmaName = u ? u.name[0] : "";
  function currentSuggestions() {
    // After selecting one uma, keep the selector open to all umas unless the user types a new query.
    if (props.value && query.input === selectedUmaName) {
      return umaAltIds;
    }
    return query.suggestions;
  }

  function confirm(oid) {
    setOpen(false);
    props.select(oid);
    const uname = umas[oid.slice(0, 4)].name[0];
    search(uname);
    setActiveIdx(-1);
    if (input.current != null) {
      input.current.value = uname;
      input.current.blur();
    }
  }

  function focus() {
    input.current && input.current.select();
  }

  function setActiveAndScroll(idx) {
    setActiveIdx(idx);
    if (!suggestionsContainer.current) return;
    const suggestions = currentSuggestions();
    const container = suggestionsContainer.current;
    const li = container.querySelector(
      `[data-uma-id="${suggestions[idx]}"]`
    );
    if (!li) return;
    const ch = container.offsetHeight - 4; // 4 for borders
    if (li.offsetTop < container.scrollTop) {
      container.scrollTop = li.offsetTop;
    } else if (li.offsetTop >= container.scrollTop + ch) {
      const h = li.offsetHeight;
      container.scrollTop = (li.offsetTop / h - (ch / h - 1)) * h;
    }
  }

  function handleClick(e) {
    const li = e.target.closest(".umaSuggestion");
    if (li == null) return;
    e.stopPropagation();
    confirm(li.dataset.umaId);
  }

  function handleInput(e) {
    search(e.target.value);
  }

  function handleKeyDown(e) {
    const suggestions = currentSuggestions();
    const l = suggestions.length;
    if (l == 0) return;
    switch (e.keyCode) {
      case 13:
        if (activeIdx > -1) confirm(suggestions[activeIdx]);
        break;
      case 38:
        setActiveAndScroll((activeIdx - 1 + l) % l);
        break;
      case 40:
        setActiveAndScroll((activeIdx + 1 + l) % l);
        break;
    }
  }

  function handleBlur(e) {
    if (e.target.value.length == 0) props.select("");
    setOpen(false);
  }

  return (
    <div class="umaSelector">
      <div class="umaSelectorIconsBox" onClick={focus}>
        <img src={props.value ? iconUrl(icons[props.value]) : randomMob} />
        <img src={`${ICON_BASE}/utx_ico_umamusume_00.png`} />
      </div>
      <div class="umaEpithet">
        <span>{props.value && u.outfits[props.value]}</span>
      </div>
      <div class="umaSelectWrapper">
        <input
          type="text"
          class="umaSelectInput"
          value={query.input}
          tabindex={props.tabindex}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          ref={input}
        />
        <ul
          class={`umaSuggestions ${open ? "open" : ""}`}
          onMouseDown={handleClick}
          ref={suggestionsContainer}
        >
          {currentSuggestions().map((oid, i) => {
            const uid = oid.slice(0, 4);
            return (
              <li
                key={oid}
                data-uma-id={oid}
                class={`umaSuggestion ${i == activeIdx ? "selected" : ""}`}
              >
                <img src={iconUrl(icons[oid])} />
                <span>
                  {umas[uid].outfits[oid]} {umas[uid].name[0]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function rankForStat(x: number) {
  if (x > 1200) {
    // over 1200 letter (eg UG) goes up by 100 and minor number (eg UG8) goes up by 10
    return Math.min(
      18 + Math.floor((x - 1200) / 100) * 10 + (Math.floor(x / 10) % 10),
      97
    );
  } else if (x >= 1150) {
    return 17; // SS+
  } else if (x >= 1100) {
    return 16; // SS
  } else if (x >= 400) {
    // between 400 and 1100 letter goes up by 100 starting with C (8)
    return 8 + Math.floor((x - 400) / 100);
  } else {
    // between 1 and 400 letter goes up by 50 starting with G+ (0)
    return Math.floor(x / 50);
  }
}

export function Stat(props) {
  return (
    <div class="horseParam">
      <img
        src={`${ICON_BASE}/statusrank/ui_statusrank_${(
          100 + rankForStat(props.value)
        )
          .toString()
          .slice(1)}.png`}
      />
      <input
        type="number"
        min="1"
        max="2000"
        value={props.value}
        tabindex={props.tabindex}
        onInput={(e) => props.change(+e.currentTarget.value)}
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
          <img src={`${ICON_BASE}/status_00.png`} />
          <span>速度</span>
        </div>
        <div class="horseParamHeader">
          <img src={`${ICON_BASE}/status_01.png`} />
          <span>耐力</span>
        </div>
        <div class="horseParamHeader">
          <img src={`${ICON_BASE}/status_02.png`} />
          <span>力量</span>
        </div>
        <div class="horseParamHeader">
          <img src={`${ICON_BASE}/status_03.png`} />
          <span>根性</span>
        </div>
        <div class="horseParamHeader">
          <img src={`${ICON_BASE}/status_04.png`} />
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
