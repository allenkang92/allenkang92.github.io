import { createRoot } from 'react-dom/client';
import { PostsApp, PostsAppBoundary } from './PostsApp';
import type { CatalogEntry } from './model';

function readFallbackPosts(fallbackElement: HTMLElement): {
  posts: CatalogEntry[];
  categoryLabels: Map<string, string>;
} {
  const categoryLabels = new Map<string, string>();
  const posts = Array.from(fallbackElement.querySelectorAll<HTMLElement>('.post-preview[data-title]'))
    .flatMap(card => {
      const title = card.dataset.title?.trim() || '';
      const anchor = card.querySelector<HTMLAnchorElement>('h2 a[href]');
      const href = anchor?.getAttribute('href') || '';
      if (!title || !href) return [];

      const categories = (card.dataset.categories || '').split(/\s+/).filter(Boolean);
      const labels = Array.from(card.querySelectorAll('.post-meta .category'))
        .map(element => element.textContent?.trim() || '')
        .filter(Boolean);
      categories.forEach((category, index) => {
        if (!categoryLabels.has(category)) categoryLabels.set(category, labels[index] || category);
      });

      return [{
        path: href,
        href,
        title,
        kind: 'post' as const,
        categories,
        categoryLabels: labels,
        tags: (card.dataset.tags || '').split(/\s+/).filter(Boolean),
        description: card.dataset.description || '',
        content: card.dataset.content || '',
        date: card.dataset.date || '',
      }];
    });

  return { posts, categoryLabels };
}

const rootElement = document.getElementById('posts-react-root');
const fallbackElement = document.getElementById('posts-static-fallback');

if (rootElement instanceof HTMLElement && fallbackElement instanceof HTMLElement) {
  try {
    const { posts, categoryLabels } = readFallbackPosts(fallbackElement);
    const searchIndexUrl = rootElement.dataset.searchIndexUrl || '/search.json';
    const siteBaseUrl = rootElement.dataset.siteBaseUrl || window.location.origin;
    const postsUrl = rootElement.dataset.postsUrl || '/posts/';
    const achievementsUrl = rootElement.dataset.achievementsUrl || '/achievements/';
    const expectedPagePaths: unknown = JSON.parse(rootElement.dataset.expectedSearchPages || 'null');
    if (!Array.isArray(expectedPagePaths) || !expectedPagePaths.every(path => typeof path === 'string')) {
      throw new TypeError('Searchable page paths are unavailable.');
    }
    const expectedAchievementPaths: unknown = JSON.parse(rootElement.dataset.expectedAchievementPaths || 'null');
    if (!Array.isArray(expectedAchievementPaths) || !expectedAchievementPaths.every(path => typeof path === 'string')) {
      throw new TypeError('Searchable achievement paths are unavailable.');
    }
    const root = createRoot(rootElement);

    root.render(
      <PostsAppBoundary fallbackElement={fallbackElement} rootElement={rootElement}>
        <PostsApp
          fallbackPosts={posts}
          categoryLabels={categoryLabels}
          searchIndexUrl={searchIndexUrl}
          siteBaseUrl={siteBaseUrl}
          postsUrl={postsUrl}
          achievementsUrl={achievementsUrl}
          expectedPagePaths={expectedPagePaths}
          expectedAchievementPaths={expectedAchievementPaths}
          rootElement={rootElement}
          fallbackElement={fallbackElement}
        />
      </PostsAppBoundary>,
    );
  } catch {
    rootElement.hidden = true;
    fallbackElement.hidden = false;
  }
}
