export function initFilter() {
    const categorySelect = document.getElementById('category-select');
    const achievementCategorySelect = document.getElementById('achievement-category-select');

    if (categorySelect) {
        categorySelect.addEventListener('change', filterCategories);
    }

    if (achievementCategorySelect) {
        achievementCategorySelect.addEventListener('change', filterAchievements);
    }
}

function filterCategories() {
    const select = document.getElementById('category-select');
    if (!select) return;
    
    const selectedCategory = select.value;
    const posts = document.getElementsByClassName('post-preview');
    
    for (let i = 0; i < posts.length; i++) {
        if (selectedCategory === 'all' || posts[i].getAttribute('data-category') === selectedCategory) {
            posts[i].style.display = 'block';
        } else {
            posts[i].style.display = 'none';
        }
    }
}

function filterAchievements() {
    const select = document.getElementById('achievement-category-select');
    if (!select) return;
    
    const selectedCategory = select.value;
    const categories = document.getElementsByClassName('achievement-category');

    for (let i = 0; i < categories.length; i++) {
        if (selectedCategory === 'all' || categories[i].getAttribute('data-category') === selectedCategory) {
            categories[i].style.display = 'block';
        } else {
            categories[i].style.display = 'none';
        }
    }
}
