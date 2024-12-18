const data = [
  { subject: 'Data Analysis & Science', value: 85, fullMark: 100 },
  { subject: 'Interdisciplinary Research', value: 80, fullMark: 100 },
  { subject: 'Science Communication', value: 75, fullMark: 100 },
  { subject: 'Databases', value: 70, fullMark: 100 },
  { subject: 'Data Processing', value: 65, fullMark: 100 },
];

const RadarChart = Recharts.RadarChart;
const PolarGrid = Recharts.PolarGrid;
const PolarAngleAxis = Recharts.PolarAngleAxis;
const PolarRadiusAxis = Recharts.PolarRadiusAxis;
const Radar = Recharts.Radar;

const SkillRadarChart = () => {
  return React.createElement(RadarChart, {
    width: 500,
    height: 400,
    data: data,
    style: { margin: '0 auto' }
  },
    React.createElement(PolarGrid),
    React.createElement(PolarAngleAxis, { dataKey: 'subject' }),
    React.createElement(PolarRadiusAxis),
    React.createElement(Radar, {
      name: 'Skills',
      dataKey: 'value',
      stroke: '#8884d8',
      fill: '#8884d8',
      fillOpacity: 0.6
    })
  );
};

ReactDOM.render(
  React.createElement(SkillRadarChart),
  document.getElementById('skillRadarChart')
);
