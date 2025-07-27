---
layout: default
title: Home
description: Striving for a better tomorrow, together with you.
---

<h2>Recent Posts</h2>

<div class="recent-posts">
{% for post in site.posts limit:3 %}
  <article class="post-preview">
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <div class="post-meta">
      <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y년 %m월 %d일" }}</time>
    </div>
    <div class="post-excerpt">
      {{ post.excerpt | strip_html | truncatewords: 30 }}
    </div>
  </article>
{% endfor %}
</div>
