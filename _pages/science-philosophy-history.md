---
layout: default
title: "과학철학·현대물리학"
description: "과학철학과 현대물리학 글을 순서대로 읽기 위한 시리즈 허브"
permalink: /series/science-philosophy-history/
---

{% assign series_key = "Science_Philosophy_History" %}
{% assign series_posts = site.posts | where: "series", series_key | sort: "series_order" %}

<section class="series-hub" aria-labelledby="series-hub-title">
  <p class="series-hub-eyebrow">Science / Philosophy / Modern Physics</p>
  <h1 id="series-hub-title">과학철학·현대물리학</h1>
  <p>
    과학이 지식을 만드는 방식에서 출발해, 현대 물리학이 우주의 기본 구조를 입자와 힘,
    표준 모형, 미해결 문제로 설명하는 흐름을 따라갑니다.
  </p>
  <dl class="series-hub-facts">
    <div>
      <dt>글 수</dt>
      <dd>{{ series_posts.size }}편</dd>
    </div>
    <div>
      <dt>읽는 순서</dt>
      <dd>탐구 방법에서 표준 모형과 미래 과제로 이동</dd>
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
    <li>Alan Chalmers, <cite>What Is This Thing Called Science?</cite></li>
    <li>Peter Godfrey-Smith, <cite>Theory and Reality</cite></li>
    <li>David J. Griffiths, <cite>Introduction to Elementary Particles</cite></li>
    <li>CERN, <cite>The Standard Model</cite></li>
  </ul>
</section>

<style>
.series-hub,
.series-path,
.series-reference-note {
  box-sizing: border-box;
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 0 1rem;
}

.series-hub {
  padding-top: 2rem;
  padding-bottom: 1rem;
}

.series-hub-eyebrow,
.series-path-order {
  margin: 0;
  color: #5f4b8b;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.series-hub h1 {
  margin: 0.5rem 0 0.75rem;
  color: #17211f;
}

.series-hub > p {
  max-width: 720px;
  margin: 0;
  color: #3f4a48;
  line-height: 1.75;
}

.series-hub-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin: 1.4rem 0 0;
}

.series-hub-facts div {
  padding: 1rem;
  border: 1px solid #c8d7d4;
  border-radius: 8px;
  background: #fbf8f1;
}

.series-hub-facts dt {
  color: #667085;
  font-size: 0.86rem;
  font-weight: 700;
}

.series-hub-facts dd {
  margin: 0.25rem 0 0;
  color: #17211f;
  font-weight: 700;
}

.series-path {
  padding-top: 1rem;
}

.series-path h2,
.series-reference-note h2 {
  color: #17211f;
}

.series-path > ol {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.series-path-item {
  padding: 1.25rem;
  border: 1px solid #d8dde2;
  border-left: 5px solid #00736f;
  border-radius: 8px;
  background: #fffdf8;
}

.series-path-item h3 {
  margin: 0.4rem 0 0.8rem;
  font-size: 1.2rem;
}

.series-path-item h3 a,
.series-reference-note a {
  color: #005f5f;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

.series-path-item ul {
  margin: 0;
  padding-left: 1.2rem;
}

.series-path-item li {
  margin: 0.35rem 0;
  color: #3f4a48;
  line-height: 1.6;
}

.series-reference-note {
  padding-top: 2rem;
  padding-bottom: 3rem;
}

.series-reference-note ul {
  margin: 0;
  padding-left: 1.2rem;
}

.series-reference-note li {
  margin: 0.55rem 0;
  color: #3f4a48;
  line-height: 1.6;
}

@media (max-width: 720px) {
  .series-hub-facts {
    grid-template-columns: 1fr;
  }
}
</style>
