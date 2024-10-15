import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import SkillRadarChart from './SkillRadarChart'; // Radar 차트를 외부 컴포넌트로 분리

// 지식 도메인과 기술 스택 마크다운 데이터
const knowledgeDomainsMarkdown = `
## Knowledge Domains
...
`;

const techStackMarkdown = `
## Tech Stack
...
`;

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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{knowledgeDomainsMarkdown}</ReactMarkdown>
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Skills Overview</h2>
              <SkillRadarChart />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Tech Stack</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{techStackMarkdown}</ReactMarkdown>
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Domains Tab: 지식 도메인 + 레이더 차트 */}
        <TabsContent value="knowledge-domains">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Knowledge Domains Overview</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{knowledgeDomainsMarkdown}</ReactMarkdown>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{techStackMarkdown}</ReactMarkdown>
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
