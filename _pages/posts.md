---
layout: default
title: Posts
description: Browse all blog posts by category
---

# Blog Posts

<div class="posts-filter">
  <label for="category-select">Filter by Category:</label>
  <select id="category-select">
    <option value="all">All Categories</option>
    {% for category in site.categories %}
    <option value="{{ category[0] }}">{{ category[0] | capitalize }}</option>
    {% endfor %}
  </select>
</div>

<div class="posts-list">
{% for post in site.posts %}
  <article class="post-preview" data-category="{{ post.category }}">
    <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
    <div class="post-meta">
      <time datetime="{{ post.date | date_to_xmlschema }}">
        {{ post.date | date: "%Y년 %m월 %d일" }}
      </time>
      {% if post.category %}
      <span class="category">{{ post.category }}</span>
      {% endif %}
    </div>
    <div class="post-excerpt">
      {{ post.excerpt | strip_html | truncatewords: 50 }}
    </div>
  </article>
{% endfor %}
</div>
