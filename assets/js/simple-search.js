/**
 * Simple Search Functionality
 * A lightweight, accessible search implementation for Jekyll sites
 */

(function() {
    'use strict';
    
    // DOM Elements
    let searchInput;
    let searchForm;
    let searchResults;
    let searchClearBtn;
    let searchSubmitBtn;
    let searchLoading;
    
    // State
    let searchData = [];
    let searchTimeout;
    let isSearching = false;
    
    // Initialize the search functionality
    function initSearch() {
        // Get DOM elements
        searchForm = document.querySelector('.search-form');
        searchInput = document.querySelector('.search-input');
        searchButton = document.querySelector('.search-button');
        clearButton = document.querySelector('.clear-button');
        searchResults = document.querySelector('.search-results');
        searchSpinner = document.querySelector('.search-spinner');
        
        if (!searchForm || !searchInput || !searchResults) {
            console.error('Required search elements not found');
            return;
        }
        
        // Load search data
        loadSearchData();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('Simple search initialized');
    }
        
    // Load search data from search.json
    function loadSearchData() {
        // Show loading state
        showLoading(true);
        
        // Get the correct path to search.json
        const searchJsonPath = getSearchJsonPath();
        
        fetch(searchJsonPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load search data: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                searchData = Array.isArray(data) ? data : [];
                console.log(`Loaded ${searchData.length} posts for search`);
                // If there's a search query in the URL, perform the search
                const urlParams = new URLSearchParams(window.location.search);
                const searchQuery = urlParams.get('q');
                if (searchQuery) {
                    searchInput.value = searchQuery;
                    performSearch(searchQuery);
                }
            })
            .catch(error => {
                console.error('Error loading search data:', error);
                showError('검색 데이터를 불러오는 중 오류가 발생했습니다.');
            })
            .finally(() => {
                showLoading(false);
            });
    }
    
    // Get the correct path to search.json
    function getSearchJsonPath() {
        // Check if we're in a subdirectory
        const baseUrl = window.location.pathname.includes('/blog/') ? '/blog' : '';
        return `${baseUrl}/search.json`;
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Input event with debounce
        searchInput.addEventListener('input', handleSearchInput);
        
        // Form submission
        searchForm.addEventListener('submit', handleFormSubmit);
        
        // Clear button
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', clearSearch);
        }
        
        // Close search when clicking outside
        document.addEventListener('click', handleClickOutside);
        
        // Keyboard navigation
        document.addEventListener('keydown', handleKeyDown);
    }
    
    // Handle search input with debounce
    function handleSearchInput() {
        // Show/hide clear button based on input
        toggleClearButton();
        
        // Clear any existing timeout
        clearTimeout(searchTimeout);
        
        const query = searchInput.value.trim();
        
        // Hide results if input is empty
        if (query.length === 0) {
            hideResults();
            updateUrl('');
            return;
        }
        
        // Show loading state
        showLoading(true);
        
        // Debounce the search
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    }
    
    // Handle form submission
    function handleFormSubmit(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            performSearch(query);
        }
    }
    
    // Toggle clear button visibility
    function toggleClearButton() {
        if (!searchClearBtn) return;
        
        if (searchInput.value.length > 0) {
            searchClearBtn.hidden = false;
            searchInput.setAttribute('aria-expanded', 'true');
        } else {
            searchClearBtn.hidden = true;
            searchInput.setAttribute('aria-expanded', 'false');
        }
    }
    
    // Clear search input and results
    function clearSearch() {
        searchInput.value = '';
        searchInput.focus();
        hideResults();
        updateUrl('');
        toggleClearButton();
    }
    
    // Handle clicks outside the search container
    function handleClickOutside(e) {
        if (!searchForm.contains(e.target)) {
            hideResults();
        }
    }
    
    // Handle keyboard navigation
    function handleKeyDown(e) {
        // Close on Escape key
        if (e.key === 'Escape') {
            hideResults();
        }
        
        // Handle arrow key navigation in results
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const activeElement = document.activeElement;
            const resultItems = Array.from(document.querySelectorAll('.search-result-item a'));
            
            if (resultItems.length === 0) return;
            
            const currentIndex = resultItems.indexOf(activeElement);
            let nextIndex;
            
            if (e.key === 'ArrowDown') {
                nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, resultItems.length - 1);
            } else {
                nextIndex = currentIndex === -1 ? resultItems.length - 1 : Math.max(currentIndex - 1, 0);
            }
            
            resultItems[nextIndex].focus();
            e.preventDefault();
        }
    }
    
    // Perform the search
    function performSearch(query) {
        if (isSearching || !searchData || searchData.length === 0) {
            showLoading(true);
            return;
        }
        
        isSearching = true;
        
        // Show loading state
        showLoading(true);
        
        // Use requestAnimationFrame to prevent UI blocking
        requestAnimationFrame(() => {
            try {
                const queryLower = query.toLowerCase();
                const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 1); // Ignore single character terms
                
                if (queryTerms.length === 0) {
                    showNoResults('검색어를 입력하세요');
                    return;
                }
                
                // Score and filter results
                const scoredResults = searchData.map(post => {
                    const title = (post.title || '').toLowerCase();
                    const content = (post.content || '').toLowerCase();
                    const category = (post.category || '').toLowerCase();
                    const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
                    
                    let score = 0;
                    let matchCount = 0;
                    
                    for (const term of queryTerms) {
                        let termScore = 0;
                        
                        // Title matches (highest weight)
                        if (title.includes(term)) {
                            termScore += 5;
                            // Exact match bonus
                            if (title === term) termScore += 10;
                            // Match at start of title bonus
                            if (title.startsWith(term)) termScore += 5;
                        }
                        
                        // Category matches (high weight)
                        if (category.includes(term)) {
                            termScore += 3;
                        }
                        
                        // Tag matches (medium weight)
                        if (tags.includes(term)) {
                            termScore += 2;
                        }
                        
                        // Content matches (lowest weight)
                        if (content.includes(term)) {
                            termScore += 1;
                        }
                        
                        // If no matches for this term, exclude the post
                        if (termScore === 0) {
                            return { post, score: 0 };
                        }
                        
                        score += termScore;
                        matchCount++;
                    }
                    
                    // Only include posts that match all terms (AND search)
                    return matchCount === queryTerms.length ? { post, score } : { post, score: 0 };
                });
                
                // Filter, sort and limit results
                const filteredResults = scoredResults
                    .filter(item => item.score > 0)
                    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
                    .slice(0, 10) // Limit to top 10 results
                    .map(item => item.post);
                
                // Display results
                if (filteredResults.length > 0) {
                    displayResults(filteredResults, query);
                    updateUrl(query);
                } else {
                    showNoResults(`'${query}'에 대한 검색 결과가 없습니다`);
                }
            } catch (error) {
                console.error('Search error:', error);
                showError('검색 중 오류가 발생했습니다.');
            } finally {
                isSearching = false;
                showLoading(false);
            });
        }
    }
    
    // Display search results
    function displayResults(results, query) {
        if (!searchResults) return;
        
        // Highlight query terms in results
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
        
        // Build results HTML
        let html = `
            <div class="search-results-header">
                <div class="search-results-count">검색 결과: ${results.length}건</div>
            </div>
            <ul class="search-results-list">`;
        
        results.forEach(result => {
            // Highlight matches in title and excerpt
            let highlightedTitle = escapeHtml(result.title || '제목 없음');
            let excerpt = truncateText(stripHtml(result.content || ''), 150);
            
            // Apply highlighting
            queryTerms.forEach(term => {
                if (term.length < 2) return;
                
                // Highlight in title
                const titleRegex = new RegExp(`(${escapeRegex(term)})`, 'gi');
                highlightedTitle = highlightedTitle.replace(titleRegex, '<mark>$1</mark>');
                
                // Highlight in excerpt
                const contentRegex = new RegExp(`(${escapeRegex(term)})`, 'gi');
                excerpt = excerpt.replace(contentRegex, '<mark>$1</mark>');
            });
            
            // Build result item HTML
            html += `
                <li class="search-result-item">
                    <h3 class="search-result-title">
                        <a href="${result.url}">${highlightedTitle}</a>
                    </h3>`;
            
            // Add metadata (category and date)
            if (result.category || formattedDate) {
                html += `
                    <div class="search-result-meta">`;
                
                if (result.category) {
                    html += `
                        <span class="category-tag">${escapeHtml(result.category)}</span>`;
                }
                
                if (formattedDate) {
                    html += `
                        <span class="search-result-date">${formattedDate}</span>`;
                }
                
                html += `
                    </div>`;
            }
            
            // Add excerpt
            html += `
                    <div class="search-result-content">${excerpt}</div>`;
            
            // Add tags if available
            if (Array.isArray(result.tags) && result.tags.length > 0) {
                html += `
                    <div class="search-result-tags">
                        ${result.tags.map(tag => 
                            `<span class="tag">${escapeHtml(tag)}</span>`
                        ).join('\n')}
                    </div>`;
            }
            
            html += `
                </li>`;
        });
        
        html += `
            </ul>`;
        
        // Add footer with result count
        const totalResults = results.length;
        const maxResults = 10;
        
        if (totalResults > maxResults) {
            html += `
                <div class="search-results-footer">
                    <p>${maxResults}개 결과 중 ${totalResults}개 표시 중</p>
                </div>`;
        }
        
        // Update the DOM
        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
        
        // Focus the first result for keyboard navigation
        const firstResult = searchResults.querySelector('.search-result-item a');
        if (firstResult) {
            firstResult.setAttribute('tabindex', '-1');
        }
    }
    
    // Show error message
    function showError(message) {
        if (!searchResults) return;
        
        searchResults.innerHTML = `
            <div class="no-results">
                <p>${escapeHtml(message)}</p>
            </div>`;
        searchResults.style.display = 'block';
    }
    
    // Show no results message
    function showNoResults(message) {
        if (!searchResults) return;
        
        searchResults.innerHTML = `
            <div class="no-results">
                <p>${escapeHtml(message)}</p>
                <p>다른 검색어로 시도해 보세요.</p>
            </div>`;
        searchResults.style.display = 'block';
    }
    
    // Hide search results
    function hideResults() {
        if (searchResults) {
            searchResults.style.display = 'none';
        }
    }
    
    // Update URL with search query
    function updateUrl(query) {
        if (!history.pushState) return;
        
        const url = new URL(window.location);
        
        if (query) {
            url.searchParams.set('q', query);
        } else {
            url.searchParams.delete('q');
        }
        
        // Update URL without page reload
        window.history.pushState({}, '', url);
    }
    
    // Format date (YYYY-MM-DD)
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }
    
    // Strip HTML tags from content
    function stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (unsafe == null) return '';
        return unsafe.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Escape special characters for regex
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Truncate text to specified length
    function truncateText(text, maxLength) {
        if (!text) return '';
        text = text.trim();
        if (text.length <= maxLength) return text;
        
        // Try to truncate at word boundary
        let truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.7) { // Only truncate if we're not too far into the word
            truncated = truncated.substring(0, lastSpace);
        }
        
        return truncated + '...';
    }
    
    // Show loading state
    function showLoading(show) {
        if (searchLoading) {
            searchLoading.style.display = show ? 'block' : 'none';
        }
    }
    
    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSearch);
    } else {
        initSearch();
    }
    
    // Make functions available globally if needed
    window.searchFunctions = {
        initSearch: initSearch,
        performSearch: performSearch,
        clearSearch: clearSearch,
        updateUrl: updateUrl
    };
    
})();
