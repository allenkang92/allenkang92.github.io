---
layout: default
title: Achievements
---

# My Achievements

Welcome to my achievements page. Here you can find information about my certificates, education, awards, publications, and projects.

<div class="tabs-container">
  <div class="tabs">
    <button class="tabs-trigger" onclick="showCategory('certificates')">Certificates</button>
    <button class="tabs-trigger" onclick="showCategory('education')">Education</button>
    <button class="tabs-trigger" onclick="showCategory('awards')">Awards</button>
    <button class="tabs-trigger" onclick="showCategory('publications')">Publications</button>
    <button class="tabs-trigger" onclick="showCategory('projects')">Projects</button>
    <button class="tabs-trigger" onclick="showCategory('volunteering')">Volunteering</button>
    <button class="tabs-trigger" onclick="showCategory('leadership')">Leadership</button>
    <button class="tabs-trigger" onclick="showCategory('personal_development')">Personal Development</button>
    <button class="tabs-trigger" onclick="showCategory('all')">All</button>
  </div>

  <div id="achievement-content" class="card-container">
    <!-- All categories will be displayed here -->
    {% for achievement in site.achievements %}
      <div class="achievement-card" data-category="{{ achievement.category }}">
        <h2>{{ achievement.title }}</h2>
        <p>{{ achievement.content }}</p>
      </div>
    {% endfor %}
  </div>
</div>

<script>
function showCategory(category) {
  var items = document.getElementsByClassName('achievement-card');
  for (var i = 0; i < items.length; i++) {
    if (category === 'all' || items[i].getAttribute('data-category') === category) {
      items[i].style.display = 'block';
    } else {
      items[i].style.display = 'none';
    }
  }
}

// 페이지 로드 시 All 탭을 기본으로 보여줌
document.addEventListener('DOMContentLoaded', function() {
  showCategory('all');
});
</script>
