import { h, Fragment } from 'preact';
import { useState, useMemo, useId } from 'preact/hooks';
import { Text, Localizer } from 'preact-i18n';

import {
	ColumnDef, SortFn, SortingState,
	createSortedRowModel, flexRender, rowSortingFeature, sortFns, tableFeatures, useTable
} from '@tanstack/preact-table';

import { Region, RegionList } from '../uma-skill-tools/Region';
import { CourseData } from '../uma-skill-tools/CourseData';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { getParser } from '../uma-skill-tools/ConditionParser';
import { buildBaseStats, buildSkillData, Perspective } from '../uma-skill-tools/RaceSolverBuilder';

import type { HorseState } from '../components/HorseDef';
import { runComparison } from './compare';

import './BasinnChart.css';

import skillnames from '../uma-skill-tools/data/skillnames.json';
import skill_meta from '../skill_meta.json';

function skillmeta(id: string) {
	// handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
	return skill_meta[id.split('-')[0]];
}

export function getActivateableSkills(skills: string[], horse: HorseState, course: CourseData, racedef: RaceParameters) {
	const parser = getParser();
	const h2 = buildBaseStats(horse, racedef.mood);
	const wholeCourse = new RegionList();
	wholeCourse.push(new Region(0, course.distance));
	return skills.filter(id => {
		let sd;
		try {
			sd = buildSkillData(h2, racedef, course, wholeCourse, parser, id, Perspective.Any);
		} catch (_) {
			return false;
		}
		return sd.some(trigger => trigger.regions.length > 0 && trigger.regions[0].start < 9999);
	});
}

export function getNullRow(skillid: string) {
	return {id: skillid, min: 0, max: 0, mean: 0, median: 0, results: [], runData: null};
}

function formatBasinn(info) {
	return info.getValue().toFixed(2).replace('-0.00', '0.00') + ' L';
}

function SkillNameCell(props) {
	return (
		<div class="chartSkillName">
			<img src={`/uma-tools/icons/${skillmeta(props.id).iconId}.png`} />
			<span><Text id={`skillnames.${props.id}`} /></span>
		</div>
	);
}

function headerRenderer(radioGroup, selectedType, type, text, onClick) {
	function click(e) {
		e.stopPropagation();
		onClick(type);
	}
	return (c) => (
		<div>
			<input type="radio" name={radioGroup} checked={selectedType == type} title={`Show ${text.toLowerCase()} on chart`} onClick={click} />
			<span onClick={c.header.column.getToggleSortingHandler()}>{text}</span>
		</div>
	);
}

export function BasinnChart(props) {
	const radioGroup = useId();
	const [selected, setSelected] = useState('');
	const [selectedType, setSelectedType] = useState('mean');

	function headerClick(type) {
		setSelectedType(type);
		props.onRunTypeChange(type + 'run');
	}

	const columns = useMemo(() => [{
		header: () => <span>Skill name</span>,
		accessorKey: 'id',
		cell: (info) => <SkillNameCell id={info.getValue()} />,
		sortingFn: (a,b,_) => skillnames[a] < skillnames[b] ? -1 : 1
	}, {
		header: headerRenderer(radioGroup, selectedType, 'min', 'Minimum', headerClick),
		accessorKey: 'min',
		cell: formatBasinn
	}, {
		header: headerRenderer(radioGroup, selectedType, 'max', 'Maximum', headerClick),
		accessorKey: 'max',
		cell: formatBasinn,
		sortDescFirst: true
	}, {
		header: headerRenderer(radioGroup, selectedType, 'mean', 'Mean', headerClick),
		accessorKey: 'mean',
		cell: formatBasinn,
		sortDescFirst: true
	}, {
		header: headerRenderer(radioGroup, selectedType, 'median', 'Median', headerClick),
		accessorKey: 'median',
		cell: formatBasinn,
		sortDescFirst: true
	}], [selectedType]);

	const [sorting, setSorting] = useState<SortingState>([{id: 'mean', desc: true}]);

	const table = useTable({
		_features: tableFeatures({rowSortingFeature}),
		_rowModels: {sortedRowModel: createSortedRowModel(sortFns)},
		columns,
		data: props.data,
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		state: {sorting}
	});

	function handleClick(e) {
		const tr = e.target.closest('tr');
		if (tr == null) return;
		e.stopPropagation();
		const id = tr.dataset.skillid;
		if (e.target.tagName == 'IMG') {
			props.onInfoClick(id);
		} else {
			setSelected(id);
			props.onSelectionChange(id);
		}
	}

	function handleDblClick(e) {
		const tr = e.target.closest('tr');
		if (tr == null) return;
		e.stopPropagation();
		const id = tr.dataset.skillid;
		props.onDblClickRow(id);
	}

	return (
		<div class="basinnChartWrapper">
			<table class="basinnChart">
				<thead>
					{table.getHeaderGroups().map(headerGroup => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<th key={header.id} colSpan={header.colSpan}>
									{!header.isPlaceholder && (
										<div
											class={`columnHeader ${({
												'asc': 'basinnChartSortedAsc',
												'desc': 'basinnChartSortedDesc',
												'false': ''
											})[header.column.getIsSorted()]}`}
											title={header.column.getCanSort() &&
												({
													'asc': 'Sort ascending',
													'desc': 'Sort descending',
													'false': 'Clear sort'
												})[header.column.getNextSortingOrder()]}>
											{flexRender(header.column.columnDef.header, header.getContext())}
										</div>
									)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody onClick={handleClick} onDblClick={handleDblClick}>
					{table.getRowModel().rows.map(row => {
						const id = row.getValue('id');
						return (
							<tr key={row.id} data-skillid={id} class={id == selected && 'selected'} style={props.hidden.has(id) && 'display:none'}>
								{row.getAllCells().map(cell => (
									<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
