---
layout: default
title: About
permalink: /about/
---

<div class="about-page">
  <!-- 마크다운 콘텐츠 복원 -->
  <div class="about-content">
    {% include_relative about_me_all.md %}
  </div>

  <!-- 스킬 레이더 차트 -->
  <div class="radar-chart-container">
    <h2>Skills Overview</h2>
    <canvas id="skillRadarChart" width="400" height="400"></canvas>
  </div>
</div>

<!-- Chart.js 라이브러리 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<!-- About 페이지 전용 JavaScript -->
<script src="{{ '/assets/js/about-page.js' | relative_url }}" defer></script>
