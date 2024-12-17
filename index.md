---
layout: default
title: Home
description: Striving for a better tomorrow, together with you.
---

# Welcome to Allen's Blog

## About Me
{: .profile}

![Allen's profile picture](/assets/images/allen_logo_ver2.png){: .profile-pic}

- Aspirant in Cognitive Science and Neuroscience
- Physics Imp
- Developing Patent Agent
- Future Science Communicator

## Recent Posts
{: .recent-posts}

{% for post in site.posts limit:5 %}
- ### [{{ post.title }}]({{ post.url | relative_url }})
  {{ post.date | date: "%Y년 %m월 %d일" }}
  
  {{ post.excerpt | strip_html | truncatewords: 30 }}
{% endfor %}
