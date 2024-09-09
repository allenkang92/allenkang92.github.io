---
layout: default
title: Achievements
---

# My Achievements

Welcome to my achievements page. Here you can find information about my certificates, education, awards, publications, and projects.

{% for category in site.achievement_categories %}
  <h2>{{ category[1].title }}</h2>
  <ul>
    {% for subcategory in category[1].subcategories %}
      <li>
        <a href="{{ site.baseurl }}/achievements/{{ category[0] }}/{{ subcategory }}">
          {{ subcategory | capitalize | replace: '_', ' ' }}
        </a>
      </li>
    {% endfor %}
  </ul>
{% endfor %}