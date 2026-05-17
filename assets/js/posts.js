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
    const allPosts = Array.from(document.querySelectorAll('.post-preview'));
    const postsPerPage = 10;
    let currentPage = 1;
    let isExpanded = false;

    if (!toggleBtn || !postsList || !pagination || !pageInfo || !prevBtn || !nextBtn) return;

    function getSelectedCategory() {
      return categorySelect?.value || 'all';
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', function() {
      const totalPages = Math.ceil(getFilteredPosts().length / postsPerPage);
      if (currentPage >= totalPages) return;
      showPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    categorySelect?.addEventListener('change', function() {
      currentPage = 1;
      if (isExpanded) {
        showExpandedPosts();
      } else {
        showPage(1);
      }
    });

    syncToggleState();
    showPage(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPostsList);
  } else {
    initPostsList();
  }
})();
