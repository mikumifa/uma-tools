import { h } from 'preact';

import './Tooltip.css';

export function Tooltip(props) {
	return (
		<div class={`hasTooltip${props.tall ? ' contentIsTall' : ''}`}>
			{props.children}
			<div class="tooltip">{props.title}<span class="arrow" /></div>
		</div>
	);
}
