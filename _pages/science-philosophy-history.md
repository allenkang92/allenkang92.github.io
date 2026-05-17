---
layout: default
title: "과학철학·현대물리학"
description: "과학철학과 현대물리학 글을 순서대로 읽기 위한 시리즈 허브"
permalink: /series/science-philosophy-history/
---

{% assign series_record = site.data.series.items | where: "key", "Science_Philosophy_History" | first %}
{% assign series_key = series_record.key %}
{% assign series_posts = site.posts | where: "series", series_key | sort: "series_order" %}

<section class="series-hub" aria-labelledby="series-hub-title">
  <p class="series-hub-eyebrow">Science / Philosophy / Modern Physics</p>
  <h1 id="series-hub-title">{{ series_record.title }}</h1>
  <p>{{ series_record.summary }}</p>
  <dl class="series-hub-facts">
    <div>
      <dt>글 수</dt>
      <dd>{{ series_posts.size }}편</dd>
    </div>
    <div>
      <dt>읽는 순서</dt>
      <dd>{{ series_record.reading_order }}</dd>
    </div>
  </dl>
</section>
<section class="series-path" aria-labelledby="series-path-title">
  <h2 id="series-path-title">읽는 경로</h2>
  <ol>
    {% for post in series_posts %}
      <li>
        <article class="series-path-item">
          <p class="series-path-order">{{ post.series_order }}번째 글</p>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          {% if post.learning_outcomes %}
            <ul>
              {% for outcome in post.learning_outcomes limit: 3 %}
                <li>{{ outcome }}</li>
              {% endfor %}
            </ul>
          {% else %}
            <p>{{ post.excerpt | strip_html | truncatewords: 32 }}</p>
          {% endif %}
        </article>
      </li>
    {% endfor %}
  </ol>
</section>

<section class="series-reference-note" aria-labelledby="series-reference-title">
  <h2 id="series-reference-title">대표 참고자료</h2>
  <ul>
    {% for reference in series_record.references %}
      <li>{{ reference }}</li>
    {% endfor %}
  </ul>
</section>
