// Moody Diagram calculations and rendering

// Utility: Colebrook-White equation solver (returns f)
function solveColebrook(Re, relativeRoughness) {
    if (Re < 2300) {
        return 64 / Re;
    }
    // Haaland equation as initial guess
    const rr = relativeRoughness;
    let f_guess = Math.pow(-1.8 * Math.log10(Math.pow(rr / 3.7, 1.11) + 6.9 / Re), -2);
    
    // Newton-Raphson iteration for Colebrook
    let f = f_guess;
    for (let i = 0; i < 10; i++) {
        let root_f = Math.sqrt(f);
        // g(f) = 1/sqrt(f) + 2*log10(rr/3.7 + 2.51/(Re*sqrt(f))) = 0
        let next_f = 1.0 / Math.pow(-2.0 * Math.log10((rr / 3.7) + (2.51 / (Re * root_f))), 2);
        if (Math.abs(next_f - f) < 1e-8) {
            f = next_f;
            break;
        }
        f = next_f;
    }
    return f;
}

// Generate Static Curves
const reValuesLaminar = [];
for (let re = 600; re <= 3000; re += 50) {
    reValuesLaminar.push(re);
}

const reValuesTurbulent = [];
// log space generation
for (let logRe = Math.log10(3000); logRe <= 8; logRe += 0.02) {
    reValuesTurbulent.push(Math.pow(10, logRe));
}

const roughnessesList = [
    0.05, 0.04, 0.03, 0.02, 0.015, 0.01, 0.008, 0.006, 0.004, 0.002, 0.001,
    0.0008, 0.0006, 0.0004, 0.0002, 0.0001, 0.00005, 0.00001, 0.000005, 0.000001
];

// Setup chart data
const traces = [];

// 1. Laminar Line
const fLaminar = reValuesLaminar.map(re => 64 / re);
traces.push({
    x: reValuesLaminar,
    y: fLaminar,
    mode: 'lines',
    name: 'Laminar (64/Re)',
    line: { color: '#f59e0b', width: 2 },
    hoverinfo: 'skip'
});

// 2. Relative Roughness Curves
roughnessesList.forEach(rr => {
    const fTurbulent = reValuesTurbulent.map(re => solveColebrook(re, rr));
    traces.push({
        x: reValuesTurbulent,
        y: fTurbulent,
        mode: 'lines',
        name: `ε/D = ${rr}`,
        line: { color: '#475569', width: 1.5 },
        hoverinfo: 'name+text',
        text: `ε/D = ${rr}`
    });
});

// 3. Smooth Pipe curve (ε/D = 0)
const fSmooth = reValuesTurbulent.map(re => solveColebrook(re, 0));
traces.push({
    x: reValuesTurbulent,
    y: fSmooth,
    mode: 'lines',
    name: 'Smooth Pipe (ε/D=0)',
    line: { color: '#10b981', width: 2, dash: 'dash' },
    hoverinfo: 'skip'
});

// Dummy trace to activate yaxis2
traces.push({
    x: [null],
    y: [null],
    yaxis: 'y2',
    mode: 'scatter',
    showlegend: false,
    hoverinfo: 'skip'
});

// 4. Highlighted Curve (will display the curve matching current relative roughness)
traces.push({
    x: [null],
    y: [null],
    mode: 'lines',
    name: 'Current Roughness Line',
    line: { color: '#ef4444', width: 2.5 },
    hoverinfo: 'skip'
});

// 5. Dot for current flow state (will update dynamically)
traces.push({
    x: [null],
    y: [null],
    text: [null],
    mode: 'markers+text',
    textposition: 'top right',
    textfont: { size: 12, color: '#f8fafc', family: 'Inter' },
    name: 'Current State',
    marker: { color: '#3b82f6', size: 14, line: { color: '#ffffff', width: 3 } },
    hoverinfo: 'skip'
});


const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#94a3b8', family: "'Inter', sans-serif" },
    xaxis: {
        title: 'Reynolds Number, Re = ρVD/μ (Log Scale)',
        type: 'log',
        gridcolor: '#334155',
        zerolinecolor: '#334155',
        showgrid: true,
        dtick: 1, // powers of 10
        range: [Math.log10(600), 8],
        titlefont: { size: 14 }
    },
    yaxis: {
        title: 'Darcy Friction Factor, f (Log Scale)',
        type: 'log',
        gridcolor: '#334155',
        zerolinecolor: '#334155',
        showgrid: true,
        range: [Math.log10(0.007), Math.log10(0.12)],
        titlefont: { size: 14 }
    },
    yaxis2: {
        title: 'Relative Roughness, ε/D',
        overlaying: 'y',
        side: 'right',
        type: 'log',
        range: [Math.log10(0.007), Math.log10(0.12)],
        tickmode: 'array',
        tickvals: roughnessesList.map(rr => solveColebrook(Math.pow(10, 8), rr)),
        ticktext: roughnessesList.map(rr => rr.toString()),
        showgrid: false,
        zeroline: false,
        titlefont: { size: 14 },
        tickfont: { size: 10 }
    },
    showlegend: false,
    margin: { l: 70, r: 80, t: 30, b: 60 },
    hovermode: 'closest',
    annotations: [
        {
            x: Math.log10(3000),
            y: Math.log10(0.06),
            text: 'Transitional Flow',
            showarrow: false,
            font: { color: '#64748b' },
            textangle: -90
        }
    ]
};

const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

Plotly.newPlot('moodyChart', traces, layout, config).then(() => {
    // Initial calculate after chart is ready
    updateCalculations();
});

// Reactivity mapping
const inputs = {
    density: document.getElementById('density'),
    kinematic_viscosity: document.getElementById('kinematic_viscosity'),
    flow_rate: document.getElementById('flow_rate'),
    diameter: document.getElementById('diameter'),
    roughness: document.getElementById('roughness')
};

const results = {
    re: document.getElementById('res-re'),
    rr: document.getElementById('res-rr'),
    regime: document.getElementById('res-regime'),
    f: document.getElementById('res-f')
};

function formatScientific(num) {
    if (num > 1e6 || num < 1e-4) return num.toExponential(3);
    return num.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function updateCalculations() {
    const rho = parseFloat(inputs.density.value);
    const nu = parseFloat(inputs.kinematic_viscosity.value);
    const Q = parseFloat(inputs.flow_rate.value);
    const D = parseFloat(inputs.diameter.value);
    const eps = parseFloat(inputs.roughness.value);
    
    if ([rho, nu, Q, D, eps].some(isNaN) || nu <= 0 || D <= 0) {
        return; // invalid input
    }
    
    const area = Math.PI * Math.pow(D / 2, 2);
    const V = Q / area;
    const re = (V * D) / nu;
    const rr = eps / D;
    
    let regime = "Turbulent";
    if (re < 2300) regime = "Laminar";
    else if (re < 4000) regime = "Transitional";
    
    let f = 0.0;
    if (re > 0) {
        f = solveColebrook(re, rr);
    }
    
    // Update DOM
    results.re.innerText = formatScientific(re);
    results.rr.innerText = formatScientific(rr);
    results.regime.innerText = regime;
    results.regime.style.color = (regime === 'Laminar') ? 'var(--laminar)' : (regime === 'Turbulent' ? 'var(--accent)' : '#ef4444');
    results.f.innerText = f.toFixed(5);
    
    // Calculate current relative roughness curve to highlight
    const fCurrentRR = reValuesTurbulent.map(r => solveColebrook(r, rr));

    // Update Chart
    // traces.length - 2 is the Current Roughness Line
    Plotly.restyle('moodyChart', { x: [reValuesTurbulent], y: [fCurrentRR] }, [traces.length - 2]);
    
    // traces.length - 1 is the Current State Dot
    const dotText = `f: ${f.toFixed(5)}<br>Re: ${formatScientific(re)}<br>ε/D: ${formatScientific(rr)}`;
    const dotPos = re > 50000 ? 'bottom left' : 'top right';
    Plotly.restyle('moodyChart', { x: [[re]], y: [[f]], text: [[dotText]], textposition: [dotPos] }, [traces.length - 1]);
}

// Listen to all inputs
Object.values(inputs).forEach(input => {
    input.addEventListener('input', updateCalculations);
});

// Reactivity mapping relies on updateCalculations being defined above
// Input listeners are bound below (already handled cleanly)

const materialList = document.getElementById('materialList');

// Listen to material dropdown changes
materialList.addEventListener('change', () => {
    if (materialList.value !== 'custom') {
        inputs.roughness.value = materialList.value;
        updateCalculations();
    }
});

const fluidList = document.getElementById('fluidList');

fluidList.addEventListener('change', () => {
    if (fluidList.value === 'water') {
        inputs.density.value = '998';
        inputs.kinematic_viscosity.value = '0.000001004';
    } else if (fluidList.value === 'air') {
        inputs.density.value = '1.204';
        inputs.kinematic_viscosity.value = '0.00001511';
    } else if (fluidList.value === 'oil') {
        inputs.density.value = '888';
        inputs.kinematic_viscosity.value = '0.0009';
    }
    if (fluidList.value !== 'custom') {
        updateCalculations();
    }
});

inputs.density.addEventListener('input', () => fluidList.value = 'custom');
inputs.kinematic_viscosity.addEventListener('input', () => fluidList.value = 'custom');

// When inputs change manually, set material list back to custom if roughness changes
inputs.roughness.addEventListener('input', () => {
    materialList.value = 'custom';
});

