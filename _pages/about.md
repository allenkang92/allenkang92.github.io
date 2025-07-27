---
layout: default
title: About
permalink: /about/
---

<div class="about-page">
  <div class="about-content">
    {% include_relative about_me_all.md %}
  </div>

  <!-- 탭 네비게이션 -->
  <div class="about-tabs">
    <div class="tab-buttons">
      <button class="tab-button active" data-tab="knowledge-domains">Knowledge Domains</button>
      <button class="tab-button" data-tab="tech-stack">Tech Stack</button>
      <button class="tab-button" data-tab="all">All</button>
    </div>

    <!-- 스킬 레이더 차트 -->
    <div class="radar-chart-container">
      <canvas id="skillRadarChart" width="400" height="400"></canvas>
    </div>
  </div>
</div>

<!-- Chart.js 라이브러리 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<!-- About 페이지 전용 JavaScript -->
<script src="{{ '/assets/js/about-page.js' | relative_url }}" defer></script>
