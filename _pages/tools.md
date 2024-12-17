---
layout: tools
title: Tools
description: Useful tools and resources
styles:
  - /assets/css/calculator.css
scripts:
  - /assets/js/features/BasicCalculator.js
  - /assets/js/features/PhysicsCalculator.js
  - /assets/js/features/UnitConverter.js
  - /assets/js/features/calculators.js
---

# Tools & Resources

<div class="tools-container">
  <div class="tool-card">
    <h2>Calculator</h2>
    <div class="tool-description">
      <p>A versatile calculator with basic arithmetic, physics formulas, and unit conversion capabilities.</p>
    </div>
    {% include components/tools/calculator.html %}
  </div>
</div>

{% for tool in site.tools %}
  <article class="tool-card">
    <h2>{{ tool.title }}</h2>
    {% if tool.icon %}
      <img src="{{ tool.icon | relative_url }}" alt="{{ tool.title }} icon" class="tool-icon">
    {% endif %}
    <div class="tool-description">
      {{ tool.content }}
    </div>
    {% if tool.link %}
      <a href="{{ tool.link }}" class="tool-link" target="_blank" rel="noopener noreferrer">
        Try Tool
      </a>
    {% endif %}
  </article>
{% endfor %}
