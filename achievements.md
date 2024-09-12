---
layout: default
title: Achievements
---

# My Achievements

Welcome to my achievements page. Here you can find information about my certificates, education, awards, publications, and projects.

<div class="category-filter">
  <label for="achievement-category-select">Filter by category:</label>
  <select id="achievement-category-select" onchange="filterAchievements()">
    <option value="all">All Categories</option>
    {% for category in site.data.achievement_categories %}
      <option value="{{ category[0] }}">{{ category[1].title }}</option>
    {% endfor %}
  </select>
</div>

{% for category in site.data.achievement_categories %}
  <div class="achievement-category" data-category="{{ category[0] }}">
    <h2>{{ category[1].title }}</h2>
    
    {% assign category_achievements = site.achievements | where: "category", category[0] %}
    {% for achievement in category_achievements %}
      <h3>{{ achievement.title }}</h3>
      {{ achievement.content }}
    {% endfor %}
    
    {% if category[1].subcategories %}
      <h3>Subcategories:</h3>
      <ul>
        {% for subcategory in category[1].subcategories %}
          <li>
            <a href="{{ site.baseurl }}/achievements/{{ category[0] }}/{{ subcategory }}">
              {{ subcategory | capitalize | replace: '_', ' ' }}
            </a>
          </li>
        {% endfor %}
      </ul>
    {% endif %}
  </div>
{% endfor %}

<script>
function filterAchievements() {
  var select = document.getElementById('achievement-category-select');
  var selectedCategory = select.value;
  var categories = document.getElementsByClassName('achievement-category');
  
  for (var i = 0; i < categories.length; i++) {
    if (selectedCategory === 'all' || categories[i].getAttribute('data-category') === selectedCategory) {
      categories[i].style.display = 'block';
    } else {
      categories[i].style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var achievementCategorySelect = document.getElementById('achievement-category-select');
  if (achievementCategorySelect) {
    achievementCategorySelect.addEventListener('change', filterAchievements);
  }
});
</script>