import {
  createSampleAnnotation,
  getMaxMutations,
  getTotalMutations,
  groupDataByMutation,
} from './utils.js';

import { id83Color } from '../../utils/colors.js';

function cappedIndelLabel(mutationType) {
  const [length, eventType, contextType, rawIndex] = String(
    mutationType || ''
  ).split(':');
  const value = Number(rawIndex);
  if (!Number.isFinite(value)) return rawIndex || '';

  if (eventType === 'Del' && contextType !== 'M') {
    const homopolymerLength = value + 1;
    return homopolymerLength >= 6 ? '6+' : String(homopolymerLength);
  }

  if (value >= 5) return '5+';
  return String(value);
}

function cappedIndelGroupLabel(groupKey) {
  const [length, eventType, contextType] = String(groupKey || '').split(':');
  if (length === '1') return contextType || '';
  const numericLength = Number(length);
  return Number.isFinite(numericLength) && numericLength >= 5
    ? `${numericLength}+`
    : length;
}

export default function ID83(apiData, title = '') {
  const colors = id83Color;

  const indelRegex = /^(.{7})/;
  const mutationGroupSort = (a, b) => {
    const order = Object.keys(colors);
    return order.indexOf(a.mutation) - order.indexOf(b.mutation);
  };

  const data = groupDataByMutation(apiData, indelRegex, mutationGroupSort);

  const arrayIDAnnXTop = [
      '1bp Deletion',
      '1bp Insertion',
      '>1bp Deletion at Repeats<br>(Deletion Length)',
      '>1bp Insertions at Repeats<br> (Insertion Length)',
      'Microhomology<br>(Deletion Length)',
    ],
    arrayIDAnnXBot = [
      'Homopolymer Length',
      'Homopolymer Length',
      'Number of Repeat Units',
      'Number of Repeat Units',
      'Microhomology Length',
    ],
    arrayIDAnnXLabel = [5, 18.5, 35, 60, 76];

  const totalMutations = getTotalMutations(apiData);
  const maxMutation = getMaxMutations(apiData);

  const indelNames = data
    .map((group) =>
      group.data.map((e) => ({
        indel: group.mutation,
        index: cappedIndelLabel(e.mutationType),
      }))
    )
    .flat();

  const traces = data.map((group, groupIndex, array) => ({
    name: group.mutation,
    type: 'bar',
    marker: { color: colors[group.mutation].shape },
    x: [...group.data.keys()].map(
      (e) =>
        e +
        array
          .slice(0, groupIndex)
          .reduce((lastIndex, b) => lastIndex + b.data.length, 0)
    ),
    y: group.data.map((e) => e.mutations || e.contribution),
    groupdata: group.data,
    //customdata: group.data.map((e) => ({ mutationType: e.mutationType })),
    customdata: group.data.map((e) => ({
      mutationOrder: e.mutationType.substring(0, 1),
      mutationType:
        e.mutationType.substring(2, 5) === 'Del' ? 'Deletion' : 'Insertion',
      extraValue: e.mutationType.substring(6, 7),
      xval: cappedIndelLabel(e.mutationType),
    })),
    hovertemplate:
      '<b>%{customdata.mutationOrder} bp %{customdata.mutationType}, %{customdata.extraValue}, %{customdata.xval}</b><br>' +
      '%{y} indels<extra></extra>',
    showlegend: false,
  }));
  const shapeAnnotations = data.map((group, groupIndex, array) => ({
    xref: 'x',
    yref: 'paper',
    xanchor: 'bottom',
    yanchor: 'bottom',
    x:
      array
        .slice(0, groupIndex)
        .reduce((lastIndex, b) => lastIndex + b.data.length, 0) +
      (group.data.length - 1) * 0.5,
    y: 1.055,
    text: `<b>${cappedIndelGroupLabel(group.mutation)}</b>`,
    showarrow: false,
    font: {
      size: 13,
      color: colors[group.mutation].text,
    },
    align: 'center',
  }));

  const xLabelAnnotation = indelNames.map((indel, index) => ({
    xref: 'x',
    yref: 'paper',
    xanchor: 'bottom',
    yanchor: 'bottom',
    x: index,
    y: -0.16,
    text: '<b>' + indel.index + '</b>',
    showarrow: false,
    font: {
      size: 11,
    },
    align: 'center',
  }));

  const annotationsIDTopLabel = arrayIDAnnXLabel.map((num, index) => ({
    xref: 'x',
    yref: 'paper',
    x: num,
    xanchor: 'bottom',
    y: 1.22,
    yanchor: 'bottom',
    text: '<b>' + arrayIDAnnXTop[index] + '</b>',
    showarrow: false,
    font: {
      size: 15,
      family: 'Times New Roman',
    },
    align: 'center',
  }));

  const annotationsIDBotLabel = arrayIDAnnXLabel.map((num, index) => ({
    xref: 'x',
    yref: 'paper',
    x: num,
    xanchor: 'bottom',
    y: -0.28,
    yanchor: 'bottom',
    text: '<b>' + arrayIDAnnXBot[index] + '</b>',
    showarrow: false,
    font: {
      size: 13,
      family: 'Times New Roman',
    },
    align: 'center',
  }));
  const sampleAnnotation = createSampleAnnotation(apiData);

  const topShapes = data.map((group, groupIndex, array) => ({
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: array
      .slice(0, groupIndex)
      .reduce((lastIndex, e) => lastIndex + e.data.length, -0.4),
    x1: array
      .slice(0, groupIndex + 1)
      .reduce((lastIndex, e) => lastIndex + e.data.length, -0.6),
    y0: 1.13,
    y1: 1.06,
    fillcolor: colors[group.mutation].shape,
    line: {
      width: 0,
    },
  }));

  const bottomShapes = data.map((group, groupIndex, array) => ({
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: array
      .slice(0, groupIndex)
      .reduce((lastIndex, e) => lastIndex + e.data.length, -0.4),
    x1: array
      .slice(0, groupIndex + 1)
      .reduce((lastIndex, e) => lastIndex + e.data.length, -0.6),
    y0: -0.035,
    y1: -0.12,
    fillcolor: colors[group.mutation].shape,
    line: {
      width: 0,
    },
  }));

  const layout = {
    title: `<b>${title}</b>`,
    hoverlabel: { bgcolor: '#FFF' },
    height: 620,
    //width:1080,
    autosize: true,
    xaxis: {
      showticklabels: false,
      showline: true,
      tickfont: { size: 11 },
      tickmode: 'array',
      tickvals: indelNames.map((_, i) => i),
      ticktext: indelNames.map((e) => e.index),
      linecolor: 'black',
      linewidth: 1,
      mirror: 'all',
      range: [-0.5, indelNames.length - 0.5],
    },
    yaxis: {
      title: {
        text:
          parseFloat(totalMutations).toFixed(2) > 1
            ? '<b>Number of Indels</b>'
            : '<b>Percentage of Indels</b>',
        font: {
          family: 'Times New Roman',
          size: 18,
        },
      },
      autorange: false,
      range: [0, maxMutation * 1.2],
      linecolor: 'black',
      linewidth: 1,
      mirror: true,
      tickformat: parseFloat(totalMutations).toFixed(2) > 1 ? '~s' : '.1%',
    },

    shapes: [...topShapes, ...bottomShapes],
    annotations: [
      ...shapeAnnotations,
      ...xLabelAnnotation,
      ...annotationsIDTopLabel,
      ...annotationsIDBotLabel,
      sampleAnnotation,
    ],
  };

  return { traces, layout };
}
