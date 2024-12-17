---
layout: default
title: Home
description: Striving for a better tomorrow, together with you.
---

## Recent Posts
{: .recent-posts}

{% for post in site.posts limit:5 %}
- ### [{{ post.title }}]({{ post.url | relative_url }})
  {{ post.date | date: "%Y년 %m월 %d일" }}
  
  {{ post.excerpt | strip_html | truncatewords: 30 }}
{% endfor %}
