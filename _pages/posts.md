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
    {% assign categories = site.posts | map: "category" | uniq %}
    {% for category in categories %}
      {% if category %}
        <option value="{{ category }}">{{ category | capitalize }}</option>
      {% endif %}
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

<style>
.posts-filter {
  margin-bottom: 2rem;
}

.posts-filter select {
  padding: 0.5rem;
  margin-left: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.post-preview {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.post-meta {
  color: #666;
  margin: 0.5rem 0;
}

.post-meta time {
  margin-right: 1rem;
}

.category {
  background: #f0f0f0;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
}

.post-excerpt {
  color: #444;
  margin-top: 1rem;
}
</style>

<script>
document.getElementById('category-select').addEventListener('change', function() {
  const selectedCategory = this.value;
  const posts = document.querySelectorAll('.post-preview');
  
  posts.forEach(post => {
    const postCategory = post.dataset.category;
    if (selectedCategory === 'all' || selectedCategory === postCategory) {
      post.style.display = 'block';
    } else {
      post.style.display = 'none';
    }
  });
});
</script>
