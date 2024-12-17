// Import modules
import { initSearch } from './modules/search';
import { initModal } from './modules/modal';
import { initFilter } from './modules/filter';

// Initialize features
document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    initModal();
    initFilter();
});
