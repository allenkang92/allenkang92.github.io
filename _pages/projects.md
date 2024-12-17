---
layout: default
title: Projects
description: Explore my projects and contributions
---

# Projects

{% for project in site.projects %}
  {% unless project.hidden %}
    <article class="project-card">
      <h2><a href="{{ project.url | relative_url }}">{{ project.title }}</a></h2>
      {% if project.thumbnail %}
        <img src="{{ project.thumbnail | relative_url }}" alt="{{ project.title }}" class="project-thumbnail">
      {% endif %}
      <div class="project-meta">
        {% if project.technologies %}
          <div class="technologies">
            {% for tech in project.technologies %}
              <span class="tech-tag">{{ tech }}</span>
            {% endfor %}
          </div>
        {% endif %}
      </div>
      <div class="project-description">
        {{ project.excerpt | strip_html | truncatewords: 50 }}
      </div>
    </article>
  {% endunless %}
{% endfor %}
