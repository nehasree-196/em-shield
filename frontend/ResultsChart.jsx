// ResultsChart.jsx — one Plotly line chart used by pages 3, 4 and 5 (plots data from the backend, never computes it).
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';

const Plot = createPlotlyComponent(Plotly);
const COLORS = ['#5b3df5', '#e0457b', '#1f9d8a', '#d98e04'];

// traces: [{name, y}], x: array, failRanges: [{start_hz,end_hz}] shaded red, target: dB line
export default function ResultsChart({ title, x, traces, xTitle, yTitle, logX = false, target = null, failRanges = [], yRange = null }) {
  const shapes = failRanges.map((r) => ({
    type: 'rect', xref: 'x', yref: 'paper', x0: r.start_hz, x1: r.end_hz, y0: 0, y1: 1,
    fillcolor: 'rgba(220,38,38,0.15)', line: { width: 0 },
  }));
  if (target !== null) {
    shapes.push({ type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: target, y1: target, line: { color: '#dc2626', dash: 'dash', width: 1.5 } });
  }
  return (
    <Plot
      data={traces.map((t, i) => ({ x, y: t.y, name: t.name, type: 'scatter', mode: 'lines', line: { color: COLORS[i % COLORS.length], width: 2 } }))}
      layout={{
        title: { text: title, font: { size: 15 } },
        autosize: true, height: 340, margin: { l: 60, r: 20, t: 40, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(255,255,255,0.6)',
        xaxis: { title: xTitle, type: logX ? 'log' : 'linear', ticksuffix: logX ? 'Hz' : '' },
        yaxis: { title: yTitle, range: yRange || undefined },
        legend: { orientation: 'h', y: -0.25 }, shapes,
      }}
      config={{ responsive: true, displaylogo: false }}
      useResizeHandler
      style={{ width: '100%' }}
    />
  );
}
