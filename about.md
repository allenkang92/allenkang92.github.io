---
layout: default
title: About
---

<div id="about-content">
  {% capture my_include %}{% include_relative about_me_all.md %}{% endcapture %}
  {{ my_include | markdownify }}
</div>

<div id="skill-chart" style="width: 100%; height: 400px;"></div>

<script src="{{ '/assets/js/bundle.js' | relative_url }}"></script>