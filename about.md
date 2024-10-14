---
layout: default
title: About
---

<div id="about-content">
  {% include_relative about_me_all.md %}
</div>

<div id="skill-chart"></div>

<script src="/assets/js/react-components.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    ReactDOM.render(
      React.createElement(SkillRadarChart),
      document.getElementById('skill-chart')
    );
  });
</script>