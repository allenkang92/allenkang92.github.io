---
layout: default
title: Series
description: Browse blog posts by series
---

# Series

{% assign series = site.posts | map: "series" | uniq %}
{% for series_name in series %}
  {% if series_name %}
    <section class="series-section">
      <h2>{{ series_name }}</h2>
      <ul class="series-posts">
        {% assign series_posts = site.posts | where: "series", series_name %}
        {% for post in series_posts %}
          <li>
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            <span class="post-date">{{ post.date | date: "%Y-%m-%d" }}</span>
          </li>
        {% endfor %}
      </ul>
    </section>
  {% endif %}
{% endfor %}
