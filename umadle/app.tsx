import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import Autocomplete from 'accessible-autocomplete/preact';
import { Rule30CARng } from '../uma-skill-tools/Random';

import './app.css';
import '../node_modules/accessible-autocomplete/dist/accessible-autocomplete.min.css';

import icons from './icons.json';
import umas from './numbers.json';

const NUM_GUESSES = 10;

function Square(props) {
  return (
    <div class={`square ${props.status}`}>
      {props.number ? props.number.toString() : ''}
    </div>
  );
}

function Icon(props) {
  if (props.uma == null) {
    return <div class="icon" />;
  }
  return (
    <div class="icon">
      <img src={icons[props.uma]} />
      <span>{props.uma}</span>
    </div>
  );
}

function judge(guess, target) {
  if (guess == target) {
    return 'green';
  } else if (guess < target) {
    return 'yellow';
  } else if (guess > target) {
    return 'blue';
  }
}

function Row(props) {
  const guess = umas[props.guessedUma] || [];
  const statuses = guess.length > 0
    ? guess.map((g,i) => judge(g, props.targetNumbers[i]))
    : ['empty', 'empty', 'empty', 'empty', 'empty'];
  return (
    <Fragment>
      <Icon uma={props.guessedUma} />
      <Square number={guess[0]} status={statuses[0]} />
      <Square number={guess[1]} status={statuses[1]} />
      <Square number={guess[2]} status={statuses[2]} />
      <Square number={guess[3]} status={statuses[3]} />
    </Fragment>
  );
}

function Grid(props) {
  return (
    <div class="grid">
      <div class="header"></div>
      <div class="header">Bust</div>
      <div class="header">Waist</div>
      <div class="header">Hip</div>
      <div class="header">Height</div>
      {Array(NUM_GUESSES).fill().map((_,i) => <Row guessedUma={props.guesses[i]} targetNumbers={props.target} />)}
    </div>
  );
}

const emojiIcons = {
  'blue': String.fromCodePoint(0x1f7e6),
  'yellow': String.fromCodePoint(0x1f7e8),
  'green': String.fromCodePoint(0x1f7e9)
}
function CopyButton(props) {
  const [copied, setCopied] = useState(() => false);
  useEffect(() => {
    if (copied) {
      setTimeout(() => setCopied(false), 3000);
    }
  }, [copied]);

  function copy() {
    const win = props.result == 'win' ? `I solved it in ${props.guesses.length} guesses!` : 'I failed :(';
    const target = umas[props.target];
    const guesses = props.guesses.map(g => umas[g].map((h,i) => emojiIcons[judge(h, target[i])]).join('')).join('\n');
    const text = `Umadle ${props.date} ${String.fromCodePoint(0x1f40e)}
${win}
${guesses}
https://alpha123.github.io/uma-tools/umadle`;
    navigator.clipboard.writeText(text);
    setCopied(true);
  }

  if (copied) {
    return (
      <span>✓ Copied</span>
    );
  } else {
    return (
      <a href="#" id="copyresult" onClick={copy}>Copy to clipboard</a>
    );
  }
}

function Done(props) {
  if (props.result == 'win') {
    return (
      <div class="result correct">
        <div>Correct!</div>
        {!props.isPractice && <CopyButton result="win" guesses={props.guesses} target={props.target} date={props.date} />}
        <a href="#" onClick={props.practiceCb}>{props.isPractice ? "Go again" : "Practice"}</a>
      </div>
    );
  } else {
    return (
      <div class="result failed">
        <div>:(</div>
        <div id="trueanswer"><span>Answer: </span><img src={icons[props.target]} /><span>{props.target}</span></div>
        {!props.isPractice && <CopyButton result="lose" guesses={props.guesses} target={props.target} date={props.date} />}
        <a href="#" onClick={props.practiceCb}>{props.isPractice ? "Go again" : "Practice"}</a>
      </div>
    );
  }
}

const localdate = new Date();
const utc = localdate.getTime() + localdate.getTimezoneOffset() * 60000;
const dtoday = new Date(utc + -6 * 3600000);
const today = dtoday.toLocaleDateString('ja-JP', {year: 'numeric', month: '2-digit', day: '2-digit'}).replace(/\//g, '-');
const rng = new Rule30CARng(Math.imul(dtoday.getFullYear(), 524287) ^ Math.imul(dtoday.getMonth(), 6700417) ^ Math.imul(dtoday.getDay(), 131071));
for (let i = 0; i < 1000; ++i) {
  rng.step();
}
const todaysUma = Object.keys(umas)[rng.uniform(Object.keys(umas).length)];

const umaNames = Object.keys(umas);
const umaNamesForSearch = umaNames.map(u => u.toUpperCase().replace(/\./g, ''));
function suggestUma(query, populateResults) {
  const q = query.toUpperCase().replace(/\./g, '');
  populateResults(umaNames.filter((_,i) => umaNamesForSearch[i].indexOf(q) > -1));
}
function renderSuggestion(name) {
  return `<div class="suggestion"><img src="${icons[name]}"><span>${name}</span></div>`;
}

function App(props) {
  const [uma, setUma] = useState(() => todaysUma);
  const [done, setDone] = useState(() => false);
  const [guesses, setGuesses] = useState(() => []);
  const [isPractice, setPractice] = useState(() => false);

  function doGuess(guessedUma) {
    if (!umas.hasOwnProperty(guessedUma)) {
      return;
    }
    const newGuesses = guesses.concat([guessedUma]);
    setGuesses(newGuesses);
    if (guessedUma == uma) {
      setDone('win');
    } else if (newGuesses.length == NUM_GUESSES) {
      setDone('lose');
    }
    // this is a bit dumb
    window.requestAnimationFrame(() => document.getElementById('umainput').value = '');
  }

  function practice() {
    setDone(false);
    setGuesses([]);
    // use Math.random() instead of Rule30CARng#uniform() here so the sequence isn't deterministic for a given day
    setUma(Object.keys(umas)[Math.floor(Math.random() * Object.keys(umas).length)]);
    setPractice(true);
  }

  return (
    <Fragment>
      <Grid guesses={guesses} target={umas[uma]} />
      {
        done
        ? <Done result={done} guesses={guesses} target={uma} date={today} isPractice={isPractice} practiceCb={practice} />
        : <Autocomplete id="umainput" source={suggestUma} confirmOnBlur={false} onConfirm={doGuess} templates={{suggestion: renderSuggestion}} />
      }
    </Fragment>
  );
}

render(<App />, document.getElementById('app'));
