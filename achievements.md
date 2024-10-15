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
  </div>

  <div id="achievement-content" class="card-container">
    <!-- 각 카테고리에 해당하는 성취 항목들 -->
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

// 페이지 로드 시 기본으로 첫 번째 탭 (Certificates) 카테고리만 보여줌
document.addEventListener('DOMContentLoaded', function() {
  showCategory('certificates');
});

// 탭 너비를 기준으로 카드 컨테이너 너비 맞춤
document.addEventListener('DOMContentLoaded', function() {
  const tabsContainer = document.querySelector('.tabs');
  const cardContainer = document.querySelector('.card-container');
  const tabsWidth = tabsContainer.offsetWidth;

  cardContainer.style.width = `${tabsWidth}px`;  // 탭 너비를 카드 컨테이너에 맞춤
});
</script>
