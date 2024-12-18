---
layout: default
title: Posts
description: Browse all blog posts by category
permalink: /posts/
---

# Blog Posts

<div class="posts-filter">
  <label for="category-select">Filter by Category:</label>
  <select id="category-select">
    <option value="all">All Categories</option>
    {% assign categories = site.posts | map: "categories" | flatten | uniq | sort %}
    {% for category in categories %}
      {% if category %}
        <option value="{{ category }}">{{ category | replace: '_', ' ' | capitalize }}</option>
      {% endif %}
    {% endfor %}
  </select>
</div>

<div class="posts-list">
{% for post in site.posts %}
  <article class="post-preview" data-categories="{{ post.categories | join: ' ' }}">
    <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
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
      {{ post.excerpt | strip_html | truncatewords: 50 }}
    </div>
  </article>
{% endfor %}
</div>

<style>
.posts-filter {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.posts-filter select {
  padding: 0.5rem 1rem;
  margin-left: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  font-size: 1rem;
  cursor: pointer;
}

.posts-filter select:hover {
  border-color: #adb5bd;
}

.post-preview {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #dee2e6;
}

.post-preview:last-child {
  border-bottom: none;
}

.post-meta {
  margin: 0.5rem 0;
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
  margin-top: 1rem;
  line-height: 1.6;
}

.post-preview h2 {
  margin: 0;
  color: #212529;
}

.post-preview h2 a {
  text-decoration: none;
  color: inherit;
}

.post-preview h2 a:hover {
  color: #007bff;
}
</style>

<script>
document.getElementById('category-select').addEventListener('change', function() {
  const selectedCategory = this.value.toLowerCase();
  const posts = document.querySelectorAll('.post-preview');
  
  posts.forEach(post => {
    const postCategories = post.dataset.categories.toLowerCase().split(' ');
    if (selectedCategory === 'all' || postCategories.includes(selectedCategory)) {
      post.style.display = 'block';
    } else {
      post.style.display = 'none';
    }
  });
});
</script>
