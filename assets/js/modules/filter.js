export function initFilter() {
    const categorySelect = document.getElementById('category-select');
    const achievementCategorySelect = document.getElementById('achievement-category-select');

    if (categorySelect) {
        const urlCategory = new URLSearchParams(window.location.search).get('category');
        if (urlCategory && Array.from(categorySelect.options).some(option => option.value === urlCategory)) {
            categorySelect.value = urlCategory;
        }

        categorySelect.addEventListener('change', () => {
            updateCategoryUrl(categorySelect.value);
            filterCategories();
        });
        filterCategories();
    }

    if (achievementCategorySelect) {
        achievementCategorySelect.addEventListener('change', filterAchievements);
    }
}

function filterCategories() {
    const select = document.getElementById('category-select');
    if (!select) return;
    
    const selectedCategory = select.value;
    const posts = Array.from(document.getElementsByClassName('post-preview'));
    const pagination = document.getElementById('pagination');
    const postsCount = document.getElementById('posts-count');
    const isExpanded = document.getElementById('toggle-posts')?.getAttribute('aria-expanded') === 'true';
    let visibleCount = 0;
    
    posts.forEach((post, index) => {
        const categories = (post.getAttribute('data-categories') || post.getAttribute('data-category') || '').split(/\s+/);
        if (selectedCategory === 'all') {
            post.style.display = '';
            visibleCount++;
            if (!isExpanded && posts.length > 10 && index >= 10) {
                post.classList.add('hidden');
                post.classList.remove('visible');
            } else {
                post.classList.remove('hidden');
                post.classList.add('visible');
            }
        } else if (categories.includes(selectedCategory)) {
            post.style.display = '';
            visibleCount++;
            post.classList.remove('hidden');
            post.classList.add('visible');
        } else {
            post.style.display = '';
            post.classList.add('hidden');
            post.classList.remove('visible');
        }
    });

    if (pagination && selectedCategory !== 'all') {
        pagination.style.display = 'none';
    } else if (pagination && posts.length > 10 && !isExpanded) {
        pagination.style.display = 'flex';
    } else if (pagination) {
        pagination.style.display = 'none';
    }

    if (postsCount) {
        postsCount.textContent = selectedCategory === 'all'
            ? `전체 ${posts.length}개 글`
            : `선택한 카테고리 ${visibleCount}개 글`;
    }
}

function updateCategoryUrl(category) {
    const url = new URL(window.location.href);
    if (category === 'all') {
        url.searchParams.delete('category');
    } else {
        url.searchParams.set('category', category);
    }
    window.history.replaceState({}, '', url);
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
