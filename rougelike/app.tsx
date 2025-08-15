import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Rule30CARng } from '../uma-skill-tools/Random';

import { okhsv_to_srgb, srgb_to_okhsv } from './colorconversion';

import './app.css';

const NUM_GUESSES = 7;

function Icon(props) {
	return <div style={props.color?`background:rgb(${props.color.join(',')})`:''} />;
}

function Square(props) {
  return (
    <div class={`square ${props.status} ${props.focused?'focused':''}`}>
      {!isNaN(props.number) ? props.number.toString(16) : ''}
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
	if (props.input) {
	  const fi = props.input.length;
	  return (
	    <Fragment>
	    	<div class="square">#</div>
	      <Square number={props.input[0]} status="empty" focused={fi == 0} />
	      <Square number={props.input[1]} status="empty" focused={fi == 1} />
	      <Square number={props.input[2]} status="empty" focused={fi == 2} />
	      <Square number={props.input[3]} status="empty" focused={fi == 3} />
	      <Square number={props.input[4]} status="empty" focused={fi == 4} />
	      <Square number={props.input[5]} status="empty" focused={fi == 5} />
	    </Fragment>
	  );
	} else {
	  const guess = props.guess || [];
	  const statuses = guess.length > 0
	    ? guess.map((g,i) => judge(g, props.target[i]))
	    : ['empty', 'empty', 'empty'];
	  return (
	    <Fragment>
	    	<Icon color={guess} />
	      <Square number={Math.floor(guess[0] / 16)} status={statuses[0]} />
	      <Square number={guess[0] % 16} status={statuses[0]} />
	      <Square number={Math.floor(guess[1] / 16)} status={statuses[1]} />
	      <Square number={guess[1] % 16} status={statuses[1]} />
	      <Square number={Math.floor(guess[2] / 16)} status={statuses[2]} />
	      <Square number={guess[2] % 16} status={statuses[2]} />
	    </Fragment>
	  );
  }
}

function Grid(props) {
  return (
    <div class="grid">
      <div class="header h-red">Red</div>
      <div class="header h-green">Green</div>
      <div class="header h-blue">Blue</div>
      {
	      Array(NUM_GUESSES).fill().map((_,i) =>
	      	<Row guess={props.guesses[i]} target={props.target} input={i == props.guesses.length ? props.input : null} />
	      )
	    }
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
    const target = props.target;
    const guesses = props.guesses.map(g => g.map((h,i) => emojiIcons[judge(h, target[i])]).join('')).join('\n');
    const text = `Rougelike ${props.date} ${String.fromCodePoint(0x1f7e5)}
${win}
${guesses}
https://alpha123.github.io/uma-tools/rougelike`;
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
  	const [r,g,b] = props.target;
  	const hex = '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    return (
      <div class="result failed">
        <div>:(</div>
        <div id="trueanswer"><span>Answer: {hex}</span></div>
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

//function randomRouge(h,s,v) {
//	const [r,g,b] = okhsv_to_srgb((h.lo + rng.uniform(h.hi - h.lo)) / 360, (s.lo + rng.uniform(s.hi - s.lo)) / 100, (v.lo + rng.uniform(v.hi - v.lo)) / 100);
//	return [Math.round(r), Math.round(g), Math.round(b)];
//}

function dist([h1,s1,v1], [h2,s2,v2]) {
	return Math.sqrt(Math.pow(h1 - h2, 2) + Math.pow(s1 - s2, 2) + Math.pow(v1 - v2, 2));
}

function randomRouge(H,S,V, history) {
	let h,s,v;
	let cont = true;
	let tries = 0;
	while (cont && tries < 100) {
		h = (H.lo + rng.uniform(H.hi - H.lo)) / 360;
		s = (S.lo + rng.uniform(S.hi - S.lo)) / 100;
		v = (V.lo + rng.uniform(V.hi - V.lo)) / 100;
		let hist = history;
		let i = 0;
		cont = false;
		while (hist && i < 1) {
			if (dist([h,s,v], srgb_to_okhsv(...hist.head)) < 0.30 / (i + 1)) {
				cont = true;
				break;
			}
			hist = hist.tail;
			++i;
		}
		++tries;
	}
	const [r,g,b] = okhsv_to_srgb(h,s,v);
	return [Math.round(r), Math.round(g), Math.round(b)];
}

function App(props) {
  const H = {lo: 22, hi: 32};
  const S = {lo: 75, hi: 100};
  const V = {lo: 55, hi: 100};
  const [history, setHistory] = useState(() => null);
  const [rouge, setRouge] = useState(() => randomRouge(H,S,V, history));
  const [done, setDone] = useState(() => false);
  const [guesses, setGuesses] = useState(() => []);
  const [input, setInput] = useState(() => []);
  const [isPractice, setPractice] = useState(() => false);

  useEffect(() => document.getElementById('outer').focus(), [rouge]);

  function handleKeyPress(e) {
  	if (input == null) return;
  	if (e.key == 'Backspace') {
  		setInput(input.slice(0, -1));
  	} else if (/^[a-fA-F0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
  		const d = parseInt(e.key, 16);
  		if (input.length == 5) {
  			const g = [
  				input[0] * 16 + input[1],
  				input[2] * 16 + input[3],
  				input[4] * 16 + d
				];
  			setGuesses(guesses.concat([g]));
  			setInput([]);
  			if (g.every((n,i) => n == rouge[i])) {
  				setDone('win')
  				setInput(null);
  			} else if (guesses.length == NUM_GUESSES - 1) {
  				setDone('lose');
  				setInput(null);
  			}
  		} else {
	  		setInput(input.concat([d]));
  		}
  	}
  }

  function practice() {
  	const newhist = {head: rouge, tail: history};
  	setHistory(newhist);
  	setRouge(randomRouge(H,S,V, newhist));
    setDone(false);
    setGuesses([]);
    setInput([]);
    setPractice(true);
  }

  return (
    <div id="outer" tabindex="0" onKeyDown={handleKeyPress}>
    	<div id="wrapper">
	    	<div class="rougeboy" style={`background:rgb(${rouge.join(',')})`} />
	    	<Grid guesses={guesses} target={rouge} input={input} />
	    	{done && <Done result={done} guesses={guesses} target={rouge} date={today} isPractice={isPractice} practiceCb={practice} />}
    	</div>
    </div>
  );
}

render(<App />, document.getElementById('app'));
