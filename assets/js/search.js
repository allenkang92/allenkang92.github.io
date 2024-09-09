(function() {
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    var posts = [];
  
    // 포스트 데이터 로드
    fetch('{{ "/search.json" | relative_url }}')
      .then(response => response.json())
      .then(data => {
        posts = data;
      });
  
    // 검색 이벤트 리스너
    searchInput.addEventListener('input', function() {
      var query = this.value.toLowerCase();
      
      if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
      }
  
      var results = posts.filter(function(post) {
        return post.title.toLowerCase().includes(query) ||
               post.content.toLowerCase().includes(query);
      });
  
      displayResults(results);
    });
  
    function displayResults(results) {
      if (results.length === 0) {
        searchResults.innerHTML = '<p>검색 결과가 없습니다.</p>';
        return;
      }
  
      var html = '<ul>';
      results.forEach(function(result) {
        html += '<li>';
        html += '<a href="' + result.url + '">' + result.title + '</a>';
        html += '<p>' + result.content.substring(0, 150) + '...</p>';
        html += '</li>';
      });
      html += '</ul>';
  
      searchResults.innerHTML = html;
    }
  })();