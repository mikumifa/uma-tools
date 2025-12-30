import { h, Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import * as d3 from "d3";
import "./Histogram.css";

interface HistogramProps {
  data: number[];
  width: number;
  height: number;
  xLabel?: string;
}

export function Histogram({ data, width, height, xLabel = "马身差" }: HistogramProps) {
  const axes = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<d3.Bin<number, number> | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const xH = 25;
  const yW = 40;
  const effectiveWidth = width - yW;
  const effectiveHeight = height - xH;

  // Ensure data is valid
  if (!data || data.length === 0) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>暂无数据</div>;
  }

  const minVal = Math.min(0, Math.floor(d3.min(data) || 0));
  const maxVal = Math.ceil(d3.max(data) || 1);
  const domain = [minVal, maxVal] as [number, number];

  const x = d3.scaleLinear()
    .domain(domain)
    // Add some padding to domain if only one value
    .range([yW, width - 10]);

  const bucketize = d3.bin()
    .value((d: number) => d)
    .domain(x.domain() as [number, number])
    .thresholds(x.ticks(40));

  const buckets = bucketize(data);
  const maxFreq = d3.max(buckets, (b) => b.length) || 0;

  const y = d3.scaleLinear()
    .domain([0, maxFreq])
    .range([effectiveHeight, 10]);

  useEffect(() => {
    if (!axes.current) return;
    const g = d3.select(axes.current);
    g.selectAll("*").remove();

    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${effectiveHeight})`)
      .call(d3.axisBottom(x));

    // Y Axis
    g.append("g")
      .attr("transform", `translate(${yW},0)`)
      .call(d3.axisLeft(y).ticks(5));
      
    // Y Axis Grid
     g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${yW},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-effectiveWidth + yW).tickFormat(() => ""))
      .attr("stroke-opacity", 0.1);
      
  }, [data, width, height, x, y, effectiveHeight, effectiveWidth]);

  const totalSamples = data.length;

  return (
    <div class="histogram-container" ref={containerRef} style={{ position: "relative", width, height }}>
      <svg width={width} height={height}>
        <g>{buckets.map((b, i) => {
           if (b.length === 0) return null;
           const x0 = x(b.x0!);
           const x1 = x(b.x1!);
           const yVal = y(b.length);
           const barHeight = effectiveHeight - yVal;
           const isHovered = hoveredBin === b;

           return (
             <rect
               key={i}
               x={x0}
               y={yVal}
               width={Math.max(1, x1 - x0 - 1)}
               height={barHeight}
               fill={isHovered ? "#ff6fba" : "#3d7dd1"}
               stroke={isHovered ? "#333" : "none"}
               onMouseEnter={(e) => {
                  setHoveredBin(b);
                  // Calculate tooltip position relative to container
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                      setTooltipPos({
                          x: x0 + (x1-x0)/2,
                          y: yVal - 10
                      });
                  }
               }}
               onMouseLeave={() => setHoveredBin(null)}
               style={{ cursor: "pointer", transition: "fill 0.2s" }}
             />
           );
        })}</g>
        <g ref={axes}></g>
        <text 
            x={width} 
            y={height - 5} 
            text-anchor="end" 
            fill="#666" 
            font-size="10px"
        >
            {xLabel} {"->"}
        </text>
      </svg>
      {hoveredBin && (
        <div 
          class="histogram-tooltip"
          style={{
             left: tooltipPos.x + "px",
             top: tooltipPos.y + "px",
          }}
        >
           <div><strong>范围:</strong> {hoveredBin.x0?.toFixed(2)} ~ {hoveredBin.x1?.toFixed(2)} {xLabel}</div>
           <div><strong>样本数:</strong> {hoveredBin.length}</div>
           <div><strong>概率:</strong> {((hoveredBin.length / totalSamples) * 100).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}
