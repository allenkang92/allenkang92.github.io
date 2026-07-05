(function() {
  'use strict';

  function initPostsList() {
    const toggleBtn = document.getElementById('toggle-posts');
    const postsList = document.getElementById('posts-list');
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const categorySelect = document.getElementById('category-select');
    const postsCount = document.getElementById('posts-count');
    const allPosts = Array.from(document.querySelectorAll('.post-preview'));
    const postsPerPage = 10;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let currentPage = 1;
    let isExpanded = false;

    if (!toggleBtn || !postsList || !pagination || !pageInfo || !prevBtn || !nextBtn) return;

    function getSelectedCategory() {
      return categorySelect?.value || 'all';
    }

    // URL ?category= 값과 select 상태를 동기화 (북마크/공유 지원)
    function applyCategoryFromUrl() {
      if (!categorySelect) return;
      const urlCategory = new URLSearchParams(window.location.search).get('category');
      if (urlCategory && Array.from(categorySelect.options).some(option => option.value === urlCategory)) {
        categorySelect.value = urlCategory;
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

    function updatePostsCount() {
      if (!postsCount) return;
      const selectedCategory = getSelectedCategory();
      postsCount.textContent = selectedCategory === 'all'
        ? `전체 ${allPosts.length}개 글`
        : `선택한 카테고리 ${getFilteredPosts().length}개 글`;
    }

    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    }

    function getFilteredPosts() {
      const selectedCategory = getSelectedCategory();
      if (selectedCategory === 'all') return allPosts;
      return allPosts.filter(post => (post.dataset.categories || '').split(/\s+/).includes(selectedCategory));
    }

    function showPost(post) {
      post.classList.remove('hidden');
      post.classList.add('visible');
    }

    function hidePost(post) {
      post.classList.add('hidden');
      post.classList.remove('visible');
    }

    function hideNonMatchingPosts() {
      const matchingPosts = new Set(getFilteredPosts());
      allPosts.forEach(post => {
        if (!matchingPosts.has(post)) hidePost(post);
      });
    }

    function updatePaginationButtons() {
      const totalPages = Math.max(1, Math.ceil(getFilteredPosts().length / postsPerPage));
      pageInfo.textContent = `${currentPage} / ${totalPages}`;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
    }

    function updatePaginationVisibility() {
      const shouldPaginate = getSelectedCategory() === 'all'
        && !isExpanded
        && allPosts.length > postsPerPage;
      pagination.style.display = shouldPaginate ? 'flex' : 'none';
    }

    function showPage(page) {
      const filteredPosts = getFilteredPosts();
      const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
      currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * postsPerPage;
      const end = start + postsPerPage;

      allPosts.forEach(post => hidePost(post));
      filteredPosts.forEach((post, index) => {
        if (index >= start && index < end) showPost(post);
      });

      updatePaginationButtons();
      updatePaginationVisibility();
    }

    function showExpandedPosts() {
      getFilteredPosts().forEach(post => showPost(post));
      hideNonMatchingPosts();
      pagination.style.display = 'none';
    }

    function syncToggleState() {
      postsList.classList.toggle('collapsed', !isExpanded);
      toggleBtn.querySelector('.toggle-icon').textContent = isExpanded ? '▲' : '▼';
      toggleBtn.querySelector('.toggle-text').textContent = isExpanded ? '처음 10개만 보기' : '전체 글 보기';
      toggleBtn.setAttribute('aria-label', isExpanded ? '처음 10개만 보기' : '전체 글 보기');
      toggleBtn.setAttribute('aria-expanded', String(isExpanded));
    }

    toggleBtn.addEventListener('click', function() {
      isExpanded = !isExpanded;
      syncToggleState();
      if (isExpanded) {
        showExpandedPosts();
      } else {
        showPage(1);
      }
    });

    prevBtn.addEventListener('click', function() {
      if (currentPage <= 1) return;
      showPage(currentPage - 1);
      scrollToTop();
    });

    nextBtn.addEventListener('click', function() {
      const totalPages = Math.ceil(getFilteredPosts().length / postsPerPage);
      if (currentPage >= totalPages) return;
      showPage(currentPage + 1);
      scrollToTop();
    });

    categorySelect?.addEventListener('change', function() {
      currentPage = 1;
      updateCategoryUrl(getSelectedCategory());
      if (isExpanded) {
        showExpandedPosts();
      } else {
        showPage(1);
      }
      updatePostsCount();
    });

    applyCategoryFromUrl();
    syncToggleState();
    showPage(1);
    updatePostsCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPostsList);
  } else {
    initPostsList();
  }
})();
