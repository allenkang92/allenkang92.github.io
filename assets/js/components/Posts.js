import React, { useState, useEffect } from 'react';

const Posts = () => {
  const [posts, setPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // 페이지 로드 시 posts와 categories 데이터를 가져옴
    const postsData = window.site?.posts || [];
    const categoriesData = Array.from(new Set(postsData.map(post => post.category))).sort();
    
    setPosts(postsData);
    setCategories(categoriesData);

    // URL 해시가 있으면 해당 포스트로 스크롤
    if (window.location.hash) {
      const targetPost = document.querySelector(window.location.hash);
      if (targetPost) {
        targetPost.scrollIntoView();
        targetPost.classList.add('highlight');
      }
    }
  }, []);

  // 검색어와 카테고리로 포스트 필터링
  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm || 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.series?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // 검색어 입력 디바운싱
  const handleSearch = (event) => {
    const { value } = event.target;
    setSearchTerm(value);
  };

  return (
    <div className="main-content">
      <div className="posts-page">
        <h1>전체 글 목록</h1>

        <div className="posts-filter">
          <input
            type="text"
            placeholder="글 검색..."
            value={searchTerm}
            onChange={handleSearch}
            aria-label="글 검색"
          />
          <div className="filter-options">
            <label htmlFor="category-select">카테고리:</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">전체</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="posts-list">
          {filteredPosts.map(post => (
            <article key={post.url} className="post-preview">
              <h2>
                <a href={post.url}>{post.title}</a>
              </h2>
              <div className="post-meta">
                <time className="post-date" dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
                {post.series && (
                  <a href={`/series#${encodeURIComponent(post.series)}`} className="post-series">
                    {post.series}
                    {post.series_index && (
                      <span className="series-index">{post.series_index}부</span>
                    )}
                  </a>
                )}
                <span className="post-category">
                  <a href={`/categories#${encodeURIComponent(post.category)}`}>
                    {post.category || "미분류"}
                  </a>
                </span>
                {post.tags?.length > 0 && (
                  <div className="post-tags">
                    {post.tags.map(tag => (
                      <a
                        key={tag}
                        href={`/tags#${encodeURIComponent(tag)}`}
                        className="post-tag"
                      >
                        #{tag}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {post.excerpt && (
                <div className="post-excerpt">
                  {post.excerpt}
                </div>
              )}
            </article>
          ))}
          {filteredPosts.length === 0 && (
            <div className="no-results">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Posts;
