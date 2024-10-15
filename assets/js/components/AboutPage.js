import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

// 지식 도메인 마크다운 데이터
const knowledgeDomainsMarkdown = `
## Knowledge Domains

#### My Majors & Planned Majors

| **Category** | **Details** |
|--------------|-------------|
| **![My Majors](https://img.shields.io/badge/My%20Majors-EAF4FB?style=flat-square)** | ![Sports Science](https://img.shields.io/badge/Sports%20Science-A8E1DB?style=flat-square) ![Anthropology](https://img.shields.io/badge/Anthropology-A8E1DB?style=flat-square) ![Law](https://img.shields.io/badge/Law-A8E1DB?style=flat-square) ![Intellectual Property](https://img.shields.io/badge/Intellectual%20Property-A8E1DB?style=flat-square) ![Computer Engineering](https://img.shields.io/badge/Computer%20Engineering-C1B3F2?style=flat-square) |
| **![Planned Majors](https://img.shields.io/badge/Planned%20Majors-EAF4FB?style=flat-square)** | ![Data Science](https://img.shields.io/badge/Data%20Science-FFCBDF?style=flat-square) ![Mechanical Engineering](https://img.shields.io/badge/Mechanical%20Engineering-FFCBDF?style=flat-square) ![Atmospheric Science](https://img.shields.io/badge/Atmospheric%20Science-FFCBDF?style=flat-square) ![Psychology](https://img.shields.io/badge/Psychology-FFCBDF?style=flat-square) |
{:.custom-table}

#### Areas of Interest & Specific Interests

| **Category** | **Details** |
|--------------|-------------|
| **![Areas of Interest](https://img.shields.io/badge/Areas%20of%20Interest-EAF4FB?style=flat-square)** | ![Physics](https://img.shields.io/badge/Physics-A8E1DB?style=flat-square) ![Chemistry](https://img.shields.io/badge/Chemistry-A8E1DB?style=flat-square) ![Life Science](https://img.shields.io/badge/Life%20Science-A8E1DB?style=flat-square) ![Mathematics](https://img.shields.io/badge/Mathematics-A8E1DB?style=flat-square) ![Cognitive Science](https://img.shields.io/badge/Cognitive%20Science-C1B3F2?style=flat-square) ![Neuroscience](https://img.shields.io/badge/Neuroscience-C1B3F2?style=flat-square) ![Human Factors Engineering](https://img.shields.io/badge/Human%20Factors%20Engineering-C1B3F2?style=flat-square) ![Cognitive Psychology](https://img.shields.io/badge/Cognitive%20Psychology-C1B3F2?style=flat-square) ![Data Engineering](https://img.shields.io/badge/Data%20Engineering-EAF4FB?style=flat-square) |
| **![Specific Interests](https://img.shields.io/badge/Specific%20Interests-EAF4FB?style=flat-square)** | ![Brain-Computer Interface](https://img.shields.io/badge/Brain--Computer%20Interface-A8E1DB?style=flat-square) ![Human Behavior Research](https://img.shields.io/badge/Human%20Behavior%20Research-C1B3F2?style=flat-square) ![Human-Computer Interaction](https://img.shields.io/badge/Human--Computer%20Interaction-C1B3F2?style=flat-square) ![Quantum Computing](https://img.shields.io/badge/Quantum%20Computing-FFCBDF?style=flat-square) ![Bioinformatics](https://img.shields.io/badge/Bioinformatics-FFCBDF?style=flat-square) ![Environmental Issues](https://img.shields.io/badge/Environmental%20Issues-EAF4FB?style=flat-square) ![Social Impact Studies](https://img.shields.io/badge/Social%20Impact%20Studies-EAF4FB?style=flat-square) ![Philosophy of Science](https://img.shields.io/badge/Philosophy%20of%20Science-EAF4FB?style=flat-square) |
{:.custom-table}

#### Professional Experiences

| **Category** | **Details** |
|--------------|-------------|
| **![Professional Experiences](https://img.shields.io/badge/Professional%20Experiences-EAF4FB?style=flat-square)** | ![Startup Marketer](https://img.shields.io/badge/Startup%20Marketer-A8E1DB?style=flat-square) ![Financial Loan Officer](https://img.shields.io/badge/Financial%20Loan%20Officer-A8E1DB?style=flat-square) ![Chemical Engineering Researcher](https://img.shields.io/badge/Chemical%20Engineering%20Researcher-A8E1DB?style=flat-square) |
{:.custom-table}
`;


// 기술 스택 마크다운 데이터
const techStackMarkdown = `
## Tech Stack

| **Category** | **Technologies** |
|--------------|-------------------|
| **![Programming Languages](https://img.shields.io/badge/Programming%20Languages-EAF4FB?style=flat-square)** | ![Python](https://img.shields.io/badge/Python-A8E1DB?style=flat-square&logo=Python&logoColor=EAF4FB) ![C](https://img.shields.io/badge/C-C1B3F2?style=flat-square&logo=C&logoColor=EAF4FB) |
| **![Design Tools](https://img.shields.io/badge/Design%20Tools-EAF4FB?style=flat-square)** | ![Illustrator](https://img.shields.io/badge/Illustrator-A8E1DB?style=flat-square&logo=Adobe-Illustrator&logoColor=EAF4FB) ![Figma](https://img.shields.io/badge/Figma-A8E1DB?style=flat-square&logo=Figma&logoColor=EAF4FB) |
| **![Web Technologies](https://img.shields.io/badge/Web%20Technologies-EAF4FB?style=flat-square)** | ![HTML](https://img.shields.io/badge/HTML-A8E1DB?style=flat-square&logo=HTML5&logoColor=EAF4FB) ![CSS](https://img.shields.io/badge/CSS-A8E1DB?style=flat-square&logo=CSS3&logoColor=EAF4FB) |
| **![Web Frameworks](https://img.shields.io/badge/Web%20Frameworks-EAF4FB?style=flat-square)** | ![FastAPI](https://img.shields.io/badge/FastAPI-C1B3F2?style=flat-square&logo=FastAPI&logoColor=EAF4FB) |
| **![Web Crawling](https://img.shields.io/badge/Web%20Crawling-EAF4FB?style=flat-square)** | ![Selenium](https://img.shields.io/badge/Selenium-FFCBDF?style=flat-square&logo=Selenium&logoColor=EAF4FB) |
| **![ETL Tools](https://img.shields.io/badge/ETL%20Tools-EAF4FB?style=flat-square)** | ![Apache Airflow](https://img.shields.io/badge/Apache%20Airflow-C1B3F2?style=flat-square&logo=Apache-Airflow&logoColor=EAF4FB) |
| **![Databases](https://img.shields.io/badge/Databases-EAF4FB?style=flat-square)** | ![SQLite](https://img.shields.io/badge/SQLite-A8E1DB?style=flat-square&logo=SQLite&logoColor=EAF4FB) ![MySQL](https://img.shields.io/badge/MySQL-A8E1DB?style=flat-square&logo=MySQL&logoColor=EAF4FB) |
{:.custom-table}
`;

// 레이더 차트 데이터
const skillRadarData = [
  { skill: "Scientific Knowledge", value: 80 },
  { skill: "Interdisciplinary Research", value: 90 },
  { skill: "Data Analysis", value: 75 },
  { skill: "Data Management", value: 85 },
  { skill: "Programming Languages", value: 65 },
  { skill: "MLOps", value: 70 },
  { skill: "Science Communication", value: 80 },
  { skill: "Data Visualization", value: 90 },
];

const SkillRadarChart = () => (
  <ResponsiveContainer width="100%" height={400}>
    <RadarChart outerRadius={150} data={skillRadarData}>
      <PolarGrid />
      <PolarAngleAxis dataKey="skill" />
      <PolarRadiusAxis />
      <Radar name="Skills" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
    </RadarChart>
  </ResponsiveContainer>
);

const AboutPage = () => {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">About Me</h1>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="all" onClick={() => setActiveTab("all")}>All</TabsTrigger>
          <TabsTrigger value="knowledge-domains" onClick={() => setActiveTab("knowledge-domains")}>Knowledge Domains</TabsTrigger>
          <TabsTrigger value="tech-stack" onClick={() => setActiveTab("tech-stack")}>Tech Stack</TabsTrigger>
        </TabsList>

        {/* All Tab: 지식 도메인 + 기술 스택 + 레이더 차트 */}
        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Knowledge Domains Overview</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} children={knowledgeDomainsMarkdown} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Skills Overview</h2>
              <SkillRadarChart />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Tech Stack</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} children={techStackMarkdown} />
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Domains Tab: 지식 도메인 + 레이더 차트 */}
        <TabsContent value="knowledge-domains">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Knowledge Domains Overview</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} children={knowledgeDomainsMarkdown} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Skills Overview</h2>
              <SkillRadarChart />
            </div>
          </div>
        </TabsContent>

        {/* Tech Stack Tab: 기술 스택 + 레이더 차트 */}
        <TabsContent value="tech-stack">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Tech Stack</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} children={techStackMarkdown} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Skills Overview</h2>
              <SkillRadarChart />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AboutPage;
