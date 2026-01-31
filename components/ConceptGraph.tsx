
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ConceptNode, ConceptLink } from '../types';

interface ConceptGraphProps {
  data: { nodes: ConceptNode[]; links: ConceptLink[] };
}

const ConceptGraph: React.FC<ConceptGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data || !Array.isArray(data.nodes) || !data.nodes.length) return;

    const width = 800;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const simulation = d3.forceSimulation<ConceptNode>(data.nodes as any)
      .force("link", d3.forceLink<ConceptNode, ConceptLink>((Array.isArray(data.links) ? data.links : []) as any).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(Array.isArray(data.links) ? data.links : [])
      .join("line")
      .attr("stroke-width", 1);

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d) => 5 + (d.val || 5))
      .attr("fill", (d) => d3.schemeCategory10[d.group % 10])
      .call(d3.drag<SVGCircleElement, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    const labels = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text(d => d.id)
      .attr("font-size", "10px")
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("class", "fill-slate-600 font-medium pointer-events-none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    return () => simulation.stop();
  }, [data]);

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 9V3"/><path d="M12 21v-6"/><path d="M9 12H3"/><path d="M21 12h-6"/><path d="m19 19-3-3"/><path d="m19 5-3 3"/><path d="m5 19 3-3"/><path d="m5 5 3 3"/></svg>
        Conceptual Network Map
      </h3>
      <div className="flex justify-center">
        <svg ref={svgRef} width="800" height="400" className="max-w-full h-auto"></svg>
      </div>
    </div>
  );
};

export default ConceptGraph;
