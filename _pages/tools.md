---
layout: default
title: Tools
description: Useful tools and resources
---

# Tools & Resources

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
