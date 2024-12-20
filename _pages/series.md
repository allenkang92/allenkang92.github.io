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
    <h2>{{ series.name | replace: '_', ' ' }}</h2>
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
            {% if post.categories %}
              {% for category in post.categories %}
                <span class="category">{{ category | replace: '_', ' ' | capitalize }}</span>
              {% endfor %}
            {% endif %}
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
.series-list {
  max-width: 900px;
  margin: 0 auto;
}

.series-group {
  margin-bottom: 3rem;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.series-group h2 {
  color: #212529;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #dee2e6;
}

.post-preview {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.post-preview:hover {
  transform: translateY(-2px);
}

.post-preview h3 {
  margin: 0;
  color: #343a40;
}

.post-preview h3 a {
  text-decoration: none;
  color: inherit;
}

.post-preview h3 a:hover {
  color: #007bff;
}

.series-order {
  color: #6c757d;
  font-weight: normal;
  margin-right: 0.5rem;
}

.post-meta {
  margin: 0.8rem 0;
  color: #6c757d;
  font-size: 0.9rem;
}

.post-meta time {
  margin-right: 1rem;
}

.category {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  margin: 0 0.3rem;
  background: #e9ecef;
  color: #495057;
  border-radius: 15px;
  font-size: 0.85rem;
}

.post-excerpt {
  color: #495057;
  line-height: 1.6;
  margin-top: 0.8rem;
}

@media (max-width: 768px) {
  .series-group {
    padding: 1rem;
  }
  
  .post-preview {
    padding: 1rem;
  }
}
</style>
