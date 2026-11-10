(() => {
  'use strict';

  const tocContainer = document.querySelector('.table-of-contents .toc-list');
  const postContent = document.querySelector('.post-content');

  if (!tocContainer || !postContent) {
    return;
  }

  function createHeadingId(value) {
    return (value || '')
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/[^0-9a-z가-힣\-._ ]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const headings = Array.from(postContent.querySelectorAll('h2, h3'));
  if (!headings.length) {
    const tocSection = document.querySelector('.table-of-contents');
    if (tocSection) {
      tocSection.hidden = true;
    }
    return;
  }

  const headingSet = new Set(headings);
  const pageIds = new Set(
    Array.from(document.querySelectorAll('[id]'))
      .filter(element => !headingSet.has(element))
      .map(element => element.id)
      .filter(Boolean)
  );
  const reservedHeadingIds = new Set(headings.map(heading => heading.id).filter(Boolean));
  const usedIds = new Set();
  const createUniqueId = (value, fallback, reservedId = '') => {
    const baseId = value || fallback || 'section';
    let candidate = baseId;
    let suffix = 2;

    while (
      usedIds.has(candidate) ||
      pageIds.has(candidate) ||
      (reservedHeadingIds.has(candidate) && candidate !== reservedId)
    ) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  };

  let currentH3List = null;

  headings.forEach(heading => {
    const title = (heading.textContent || '').trim();
    if (!title) return;

    const titleSlug = createHeadingId(title);
    const existingId = heading.id;
    let resolvedId = existingId;

    if (!resolvedId || usedIds.has(resolvedId) || pageIds.has(resolvedId)) {
      const rawBaseId = existingId ? createHeadingId(existingId) : titleSlug;
      resolvedId = createUniqueId(rawBaseId || titleSlug, 'section', existingId);
      heading.id = resolvedId;
    }

    usedIds.add(resolvedId);

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${resolvedId}`;
    link.textContent = title;

    item.appendChild(link);

    if (heading.tagName.toLowerCase() === 'h2') {
      const nested = document.createElement('ul');
      item.appendChild(nested);
      tocContainer.appendChild(item);
      currentH3List = nested;
      return;
    }

    if (currentH3List) {
      currentH3List.appendChild(item);
      return;
    }

    tocContainer.appendChild(item);
  });

  Array.from(tocContainer.children).forEach(item => {
    const nested = item.querySelector('ul');
    if (nested && !nested.hasChildNodes()) {
      item.removeChild(nested);
    }
  });

  if (tocContainer.children.length) {
    const tocSection = document.querySelector('.table-of-contents');
    if (tocSection) {
      tocSection.hidden = false;
    }
  }
})();
