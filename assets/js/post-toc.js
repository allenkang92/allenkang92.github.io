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
  const idElements = new Map();
  Array.from(document.querySelectorAll('[id]')).forEach(element => {
    if (!element.id) return;
    const matches = idElements.get(element.id) || [];
    matches.push(element);
    idElements.set(element.id, matches);
  });
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
  // 공유한 목차 주소가 JS 없이도 유지되도록 작성된 정적 별칭만 사용한다.
  const getStaticAlias = heading => {
    const alias = heading.getAttribute('data-toc-fragment');
    if (!alias || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(alias) || anchorNames.has(alias)) return null;
    const matches = idElements.get(alias);
    if (!matches || matches.length !== 1) return null;
    const target = matches[0];
    if (target.tagName.toLowerCase() !== 'span' || target !== heading.firstElementChild
      || target.childNodes.length !== 0) return null;
    for (let sibling = target.previousSibling; sibling; sibling = sibling.previousSibling) {
      if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) return null;
    }
    for (let element = target; element; element = element.parentElement) {
      const style = window.getComputedStyle(element);
      if (element.hasAttribute('hidden') || style.display === 'none'
        || (element === target && style.display === 'contents')
        || style.visibility === 'hidden' || style.visibility === 'collapse'
        || style.contentVisibility === 'hidden') return null;
    }
    return alias;
  };
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
    link.href = `#${getStaticAlias(heading) || resolvedId}`;
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
