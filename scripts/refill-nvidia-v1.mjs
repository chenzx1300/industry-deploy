#!/usr/bin/env node
// NVIDIA (NVDA) refill: nvidianews.nvidia.com/news (Press releases only, 10 items hardcoded)
// Filter URL: ?category=press-releases&page=1 (page 1 has 10 press releases; pages 2+ also work)
// Without category filter, page defaults to blogs (blogs.nvidia.com) — must use category=press-releases
// Spot-checked: https://nvidianews.nvidia.com/news/nvidia-and-tsmc-bring-ai-into-fabs-to-advance-semiconductor-design-and-manufacturing (May 31, 2026) loads fully

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'nvidia');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('NVIDIA not found in industries.json');

const now = new Date().toISOString();

// 10 most recent press releases from page 1 (June 23, 2026 → May 31, 2026)
const NVIDIA_NEWS = [
  { date: '2026-06-23', title: 'NVIDIA Announces BioNeMo Agent Toolkit — Tools for Agents to Accelerate Scientific Discovery', url: 'https://nvidianews.nvidia.com/news/nvidia-launches-bionemo-agent-toolkit-giving-ai-agents-the-tools-to-accelerate-scientific-discovery' },
  { date: '2026-06-22', title: 'NVIDIA Vera Rubin Delivers World-Class Supercomputers for Science', url: 'https://nvidianews.nvidia.com/news/nvidia-vera-rubin-delivers-world-class-supercomputers-for-science' },
  { date: '2026-06-22', title: 'Europe Unveils a Record 35 New NVIDIA AI Supercomputers', url: 'https://nvidianews.nvidia.com/news/europe-unveils-a-record-35-new-nvidia-ai-supercomputers' },
  { date: '2026-06-22', title: 'NVIDIA Announces Halos for Robotics, the Industry’s First Full-Stack Safety System for Physical AI', url: 'https://nvidianews.nvidia.com/news/nvidia-announces-halos-for-robotics-the-industrys-first-full-stack-safety-system-for-physical-ai' },
  { date: '2026-06-11', title: 'NVIDIA Stockholder Meeting Set for June 24; Individuals Can Participate Online', url: 'https://nvidianews.nvidia.com/news/nvidia-stockholder-meeting-set-for-june-24-individuals-can-participate-online' },
  { date: '2026-06-07', title: 'SK Telecom and NVIDIA Build AI Infrastructure to Power Korea’s AI Innovation', url: 'https://nvidianews.nvidia.com/news/sk-telecom-ai-infrastructure' },
  { date: '2026-06-07', title: 'NVIDIA and SK hynix Announce Multiyear Technology Partnership to Advance Memory for AI Factories', url: 'https://nvidianews.nvidia.com/news/sk-hynix-ai-factory' },
  { date: '2026-06-07', title: 'NAVER Expands AI Infrastructure With NVIDIA to Serve Surging Global AI Demand', url: 'https://nvidianews.nvidia.com/news/naver-ai-infrastructure' },
  { date: '2026-05-31', title: 'NVIDIA and TSMC Bring AI Into Fabs to Advance Semiconductor Design and Manufacturing', url: 'https://nvidianews.nvidia.com/news/nvidia-and-tsmc-bring-ai-into-fabs-to-advance-semiconductor-design-and-manufacturing' },
  { date: '2026-05-31', title: 'NVIDIA, Foxconn and Taiwan Medical Centers Bring Agentic and Physical AI to ‘Healthy Taiwan’', url: 'https://nvidianews.nvidia.com/news/nvidia-foxconn-and-taiwan-medical-centers-bring-agentic-and-physical-ai-to-healthy-taiwan' },
];

c.news = NVIDIA_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'nvidianews.nvidia.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('NVIDIA news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);