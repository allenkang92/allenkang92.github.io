---
layout: default
title: Series
description: Browse posts by series
permalink: /series/
---

# Series

<div class="series-list">
{% assign series_posts = site.posts | where_exp: "post", "post.series != nil" | group_by: "series" %}
{% for series in series_posts %}
  <div class="series-group">
    <h2>{{ series.name }}</h2>
    <div class="series-posts">
      {% assign sorted_posts = series.items | sort: "series_order" %}
      {% for post in sorted_posts %}
        <article class="post-preview">
          <h3>
            <span class="series-order">{{ post.series_order }}.</span>
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
          </h3>
          <div class="post-meta">
            <time datetime="{{ post.date | date_to_xmlschema }}">
              {{ post.date | date: "%Y년 %m월 %d일" }}
            </time>
          </div>
          <div class="post-excerpt">
            {{ post.excerpt | strip_html | truncatewords: 30 }}
          </div>
        </article>
      {% endfor %}
    </div>
  </div>
{% endfor %}
</div>

<style>
.series-group {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.series-group h2 {
  color: #333;
  margin-bottom: 1.5rem;
}

.post-preview {
  margin-bottom: 1.5rem;
  padding-left: 1rem;
  border-left: 3px solid #f0f0f0;
}

.post-preview:hover {
  border-left-color: #007bff;
}

.series-order {
  color: #666;
  margin-right: 0.5rem;
}

.post-meta {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.post-excerpt {
  color: #444;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}
</style>
