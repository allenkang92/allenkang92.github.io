---
layout: default
title: About
---

<div id="about-content">
  {% capture my_include %}{% include_relative about_me_all.md %}{% endcapture %}
  {{ my_include | markdownify }}
</div>

<!-- React 컴포넌트가 들어갈 위치 -->
<div id="about-page"></div> <!-- 여기에 Tabs 및 Card 컴포넌트가 들어갑니다 -->
<div id="skill-chart" style="width: 100%; height: 400px;"></div>

<!-- Webpack 빌드된 React 코드 삽입 -->
<script src="{{ '/assets/js/bundle.js' | relative_url }}"></script>
