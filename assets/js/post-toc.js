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
  // 기존 fragment는 id가 없는 경우에도 <a name>을 가리킬 수 있다.
  // 새 ID 생성에만 예약해, 이미 존재하는 제목 ID의 우선순위는 보존한다.
  const anchorNames = new Set(
    Array.from(document.querySelectorAll('a[name]'))
      .map(element => element.getAttribute('name'))
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
      anchorNames.has(candidate) ||
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
    const existingId = heading.id;
    // Empty headings do not appear in the table of contents, but their IDs
    // still occupy a fragment target and must participate in collision checks.
    if (!title && !existingId) return;

    const titleSlug = createHeadingId(title);
    let resolvedId = existingId;

    if (!resolvedId || usedIds.has(resolvedId) || pageIds.has(resolvedId)) {
      const rawBaseId = existingId ? createHeadingId(existingId) : titleSlug;
      resolvedId = createUniqueId(rawBaseId || titleSlug, 'section', existingId);
      heading.id = resolvedId;
    }

    usedIds.add(resolvedId);
    if (!title) return;

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
