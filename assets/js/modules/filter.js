document.addEventListener('DOMContentLoaded', function() {
    var categorySelect = document.getElementById('category-select');
    var achievementCategorySelect = document.getElementById('achievement-category-select');

    if (categorySelect) {
        categorySelect.addEventListener('change', filterCategories);
    }

    if (achievementCategorySelect) {
        achievementCategorySelect.addEventListener('change', filterAchievements);
    }
});

function filterCategories() {
    var select = document.getElementById('category-select');
    var selectedCategory = select.value;
    var posts = document.getElementsByClassName('post-preview');
    
    for (var i = 0; i < posts.length; i++) {
        if (selectedCategory === 'all' || posts[i].getAttribute('data-category') === selectedCategory) {
            posts[i].style.display = 'block';
        } else {
            posts[i].style.display = 'none';
        }
    }
}

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
