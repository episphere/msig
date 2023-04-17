import {
  linearRegression,
  round,
  calculatePearson,
  calculateSpearman,
} from '../../utils/utils.js';

function groupBy(array, key) {
  return array.reduce(function(result, currentValue) {
    var group = currentValue[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(currentValue);
    return result;
  }, {});
}


export default function MsAssociation(
  data,
  signatureName1,
  signatureName2,
  both = false
) {
  let groupBySample;
  let xValues = [];
  let yValues = [];

  if (both) {
    const dataFilter = groupBy(
      data.filter((o) => o['exposure'] > 0),
      'sample'
    );
    if (signatureName1 === signatureName2) {
      groupBySample = { ...dataFilter };
    } else {
      groupBySample = Object.values(dataFilter).filter((e) => e.length > 1);
    }
  } else {
    groupBySample = groupBy(data, 'sample');
  }

  const dataArraySample = Object.values(groupBySample);

  for (var i = 0; i < dataArraySample.length; i++) {
    for (var j = 0; j < dataArraySample[i].length; j++) {
      if (dataArraySample[i][j].signatureName === signatureName1) {
        xValues.push(dataArraySample[i][j]);
      }
      if (dataArraySample[i][j].signatureName === signatureName2) {
        yValues.push(dataArraySample[i][j]);
      }
    }
  }

  const minX = Math.min(...xValues.map((e) => Math.log10(e['exposure'] + 1)));

  const maxX = Math.max(...xValues.map((e) => Math.log10(e['exposure'] + 1)));

  const traceSig1 = {
    //x: signatureName1data.map((e) => Math.log10(e['exposure'] + 1)),
    x: xValues.map((e) => Math.log10(e['exposure'] + 1)),
    name: signatureName1,
    type: 'histogram',
    histnorm: 'density',
    // nbinsx: round(data.length / 1.75),
    nbinsx: 35,
    yaxis: 'y2',
    marker: { color: '#019E72', line: { color: 'black', width: 1 } },
    hovertemplate:
      '<b>' +
      signatureName1 +
      '</b><br><b>x-Range of ' +
      signatureName1 +
      ' (log10)</b>: %{x}<br><b>Value (log10): </b> %{y}<extra></extra>',
  };

  const traceSig2 = {
    //y: signatureName2data.map((e) => Math.log10(e['exposure'] + 1)),
    y: yValues.map((e) => Math.log10(e['exposure'] + 1)),
    name: signatureName2,
    type: 'histogram',
    histnorm: 'density',
    // nbinsy: round(data.length / 1.75),
    nbinsy: 35,
    xaxis: 'x2',
    marker: { color: '#D55E00', line: { color: 'black', width: 1 } },
    hovertemplate:
      '<b>' +
      signatureName2 +
      '</b> <br> <b>x-range of ' +
      signatureName2 +
      ' (log10)</b> %{y}<br><b>Value (log10): </b> %{x}<extra></extra>',
  };

  const traceMain = {
    x: xValues.map((e) => Math.log10(e['exposure'] + 1)),
    y: yValues.map((e) => Math.log10(e['exposure'] + 1)),
    mode: 'markers',
    type: 'scatter',
    marker: {
      color: '#A3A3A3',
      size: 10,
    },
    opacity: 0.9,
    showlegend: false,
    hovertemplate:
      '<b>Number of mutation in ' +
      signatureName1 +
      ' (log10)</b>: %{x}<br><b>Number of mutation in ' +
      signatureName2 +
      ': (log10)</b> %{y}<extra></extra>',
  };

  const lr = linearRegression(traceMain.x, traceMain.y);

  let pearsonV;
  if (traceMain.x.length > 3) {
    pearsonV = pcorrtest(traceMain.x, traceMain.y);
  } else {
    pearsonV = calculatePearson(traceMain.x, traceMain.y);
  }
  const spearman = calculateSpearman(traceMain.x, traceMain.y);
  const traceLine = {
    x: [minX, maxX],
    y: [minX * lr.sl + lr.off, maxX * lr.sl + lr.off],
    name: 'y=' + lr.sl + ' * x + ' + lr.off,
    mode: 'lines',
    marker: {
      color: 'blue',
    },
    hovertemplate:
      '<b>x: </b> %{x}<br><b>y: </b>%{y}<br>' +
      'y=' +
      round(lr.sl, 2) +
      'x + ' +
      round(lr.off, 2) +
      '<extra></extra>',
    showlegend: false,
  };
  const traces = [traceMain, traceLine, traceSig1, traceSig2];

  const detailAnnotation = {
    xref: 'paper',
    yref: 'paper',
    x: 0,
    xanchor: 'bottom',
    y: 1.01,
    yanchor: 'bottom',
    text:
      'Pearson:\tt<sub>Student</sub> = ' +
      round(pearsonV.statistic, 2) +
      ', p = ' +
      round(pearsonV.pValue, 3) +
      ', r<sub>Pearson</sub> = ' +
      round(pearsonV.pcorr, 2) +
      ', CI<sub>95%</sub>[' +
      round(pearsonV.ci[0], 2) +
      ', ' +
      round(pearsonV.ci[1], 2) +
      '], n<sub>pairs</sub> = ' +
      dataArraySample.length +
      '<br>Spearman:\tt<sub>Student</sub> =' +
      round(spearman.t, 2) +
      ', p = ' +
      round(spearman.pValue, 3) +
      ', r<sub>Spearman</sub> = ' +
      round(spearman.rho, 2) +
      ', CI<sub>95%</sub>[' +
      round(spearman.CILower, 2) +
      ', ' +
      round(spearman.CIUpper, 2) +
      '], n<sub>pairs</sub> = ' +
      spearman.n,
    showarrow: false,
    font: {
      size: 16,
      family: 'Times New Roman',
    },
    align: 'left',
  };

  const layout = {
    showlegend: true,
    hoverlabel: { bgcolor: '#FFF' },
    height: 700,
    bargap: 0,
    autosize: true,
    title: {
      text: '<b>Mutational Signature Association</b>',
      font: {
        family: 'Arial',
        size: 18,
      },
    },
    legend: {
      title: { text: '\t Signature Names:' },
    },
    xaxis: {
      domain: [0.0, 0.83],

      showgrid: true,
      title: {
        text: '<b>Number of mutations in ' + signatureName1 + ' (log10)</b>',
      },
    },
    yaxis: {
      domain: [0.0, 0.83],
      title: {
        text: '<b>Number of mutations in ' + signatureName2 + ' (log10)</b>',
      },
      showgrid: true,
    },

    xaxis2: { anchor: 'y', domain: [0.85, 1], zerolinecolor: '#EBEBEB' },
    yaxis2: { anchor: 'x', domain: [0.85, 1], zerolinecolor: '#EBEBEB' },

    annotations: [detailAnnotation],
    margin: {
      t: 150,
    },
  };
  return { traces: traces, layout: layout };
}
function pcorrtest(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);

  const r = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  const t = r * Math.sqrt((n - 2) / (1 - r ** 2));
  const df = n - 2;
  const pValue = (1 - tDist(df).cdf(Math.abs(t))) * 2;

  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const zLower = z - 1.96 * Math.sqrt(1 / (n - 3));
  const zUpper = z + 1.96 * Math.sqrt(1 / (n - 3));
  const ciLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
  const ciUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

  return {
    pcorr: r,
    statistic: t,
    pValue: pValue,
    ci: [ciLower, ciUpper],
  };
}

function tDist(degreesOfFreedom) {
  return {
    cdf: function (x) {
      const t = x;
      const dof = degreesOfFreedom;
      const A = gamma((dof + 1) / 2) / (Math.sqrt(dof * Math.PI) * gamma(dof / 2));
      const B = Math.pow(1 + (t ** 2) / dof, -(dof + 1) / 2);
      const P = A * B;

      return 0.5 + (x > 0 ? 0.5 * betainc(P, 0.5, dof / 2) : -0.5 * betainc(P, 0.5, dof / 2));
    },
  };
}
function gamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }

  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (z + i);
  }

  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function betainc(x, a, b) {
  const lbeta_ab = Math.log(gamma(a)) + Math.log(gamma(b)) - Math.log(gamma(a + b));
  const bt = Math.exp(lbeta_ab) * Math.pow(x, a) * Math.pow(1 - x, b) / a;

  let ai = 1;
  let bi = 1;
  let f = 0;
  let m = 0;
  let m2 = 0;
  let term = 1;
  let sum = term;

  while (Math.abs(term) > 1e-10) {
    ai *= x;
    bi *= 1 - x;
    m += 1;
    m2 += 2;
    term = ai * bi / (a + m2);
    sum += term;
  }

  return bt * sum;
}
