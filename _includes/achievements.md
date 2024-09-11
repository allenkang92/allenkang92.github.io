---
layout: default
title: Achievements
---

# My Achievements

Welcome to my achievements page. Here you can find information about my certificates, education, awards, publications, and projects.

{% for category in site.achievement_categories %}
  <h2>{{ category[1].title }}</h2>
  
  {% case category[0] %}
    {% when 'certificates' %}
      {% include_relative certificates.md %}
    {% when 'education' %}
      {% include_relative education.md %}
    {% when 'awards' %}
      {% include_relative awards.md %}
    {% when 'publications' %}
      {% include_relative publications.md %}
    {% when 'projects' %}
      {% include_relative projects.md %}
  {% endcase %}
  
  <h3>Subcategories:</h3>
  <ul>
    {% for subcategory in category[1].subcategories %}
      <li>
        <a href="{{ site.baseurl }}/achievements/{{ category[0] }}/{{ subcategory | slugify }}">
          {{ subcategory | capitalize | replace: '_', ' ' }}
        </a>
      </li>
    {% endfor %}
  </ul>
{% endfor %}