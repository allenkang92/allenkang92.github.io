---
layout: default
title: Series
permalink: /series/
---

<div class="series-container">
    <h1>Series</h1>

    {% assign series_posts = site.posts | where_exp: "post", "post.series != nil" | group_by: "series" %}
    
    {% for series in series_posts %}
        {% if series.name != "" %}
        <div class="series-group">
            <h2 class="series-title">{{ series.name }}</h2>
            <div class="series-posts">
                {% assign sorted_posts = series.items | sort: "date" %}
                {% for post in sorted_posts %}
                <div class="series-post">
                    <span class="post-date">{{ post.date | date: "%Y-%m-%d" }}</span>
                    <a href="{{ post.url | relative_url }}" class="post-link">{{ post.title }}</a>
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
    {% endfor %}
</div>