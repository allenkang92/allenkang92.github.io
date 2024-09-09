(function() {
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var posts = [];
  var categories = {};

  // 포스트 데이터와 카테고리 구조 로드
  Promise.all([
      fetch('{{ "/search.json" | relative_url }}').then(response => response.json()),
      fetch('{{ "/categories.json" | relative_url }}').then(response => response.json())
  ]).then(([postsData, categoriesData]) => {
      posts = postsData;
      categories = categoriesData;
  }).catch(error => console.error('Error loading data:', error));

  // 검색 이벤트 리스너
  searchInput.addEventListener('input', function() {
      var query = this.value.toLowerCase();
      
      if (query.length < 2) {
          searchResults.style.display = 'none';
          return;
      }

      var results = posts.filter(function(post) {
          return post.title.toLowerCase().includes(query) ||
                 post.content.toLowerCase().includes(query) ||
                 (post.category && post.category.toLowerCase().includes(query)) ||
                 (post.tags && post.tags.toLowerCase().includes(query));
      });

      displayResults(results, query);
  });

  function displayResults(results, query) {
      if (results.length === 0) {
          searchResults.innerHTML = '<p>검색 결과가 없습니다.</p>';
      } else {
          var html = '<ul>';
          results.forEach(function(result) {
              html += '<li>';
              html += '<a href="' + result.url + '">' + highlightText(result.title, query) + '</a>';
              if (result.category) {
                  html += '<span class="category">' + getCategoryPath(result.category) + '</span>';
              }
              html += '<p>' + highlightText(result.content.substring(0, 150), query) + '...</p>';
              html += '</li>';
          });
          html += '</ul>';
          searchResults.innerHTML = html;
      }
      searchResults.style.display = 'block';
  }

  function highlightText(text, query) {
      return text.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`);
  }

  function getCategoryPath(category) {
      var path = [];
      var currentCategory = categories[category];
      while (currentCategory) {
          path.unshift(currentCategory.title);
          currentCategory = categories[currentCategory.parent];
      }
      return path.join(' > ');
  }

  // 검색 결과 외부 클릭 시 닫기
  document.addEventListener('click', function(event) {
      if (!searchResults.contains(event.target) && event.target !== searchInput) {
          searchResults.style.display = 'none';
      }
  });
})();