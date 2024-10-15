import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

const AboutPage = () => {
  const [activeTab, setActiveTab] = useState("all");

  const categories = [
    { id: "all", label: "All" },
    { id: "knowledge-domains", label: "Knowledge Domains" },
    { id: "tech-stack", label: "Tech Stack" },
  ];

  const knowledgeDomains = [
    {
      title: "My Majors & Planned Majors",
      data: [
        {
          category: "My Majors",
          details: ["Sports Science", "Anthropology", "Law", "Intellectual Property", "Computer Engineering"]
        },
        {
          category: "Planned Majors",
          details: ["Data Science", "Mechanical Engineering", "Atmospheric Science", "Psychology"]
        }
      ]
    },
    {
      title: "Areas of Interest & Specific Interests",
      data: [
        {
          category: "Areas of Interest",
          details: ["Physics", "Chemistry", "Life Science", "Mathematics", "Cognitive Science", "Neuroscience", "Human Factors Engineering", "Cognitive Psychology", "Data Engineering"]
        },
        {
          category: "Specific Interests",
          details: ["Brain-Computer Interface", "Human Behavior Research", "Human-Computer Interaction", "Quantum Computing", "Bioinformatics", "Environmental Issues", "Social Impact Studies", "Philosophy of Science"]
        }
      ]
    },
    {
      title: "Professional Experiences",
      data: [
        {
          category: "Professional Experiences",
          details: ["Startup Marketer", "Financial Loan Officer", "Chemical Engineering Researcher"]
        }
      ]
    }
  ];

  const KnowledgeDomainsTable = () => (
    <div className="knowledge-domains">
      {knowledgeDomains.map((section, index) => (
        <div key={index} className="mb-8">
          <h4 className="text-xl font-semibold mb-2">{section.title}</h4>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left">Category</th>
                <th className="border p-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {section.data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="border p-2">{row.category}</td>
                  <td className="border p-2">{row.details.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">About Me</h1>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>{cat.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Domains Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <KnowledgeDomainsTable />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Skills Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {/* SkillRadarChart 컴포넌트 추가 */}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="knowledge-domains">
          <KnowledgeDomainsTable />
        </TabsContent>

        <TabsContent value="tech-stack">
          {/* 테크 스택 내용을 추가 */}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AboutPage;
