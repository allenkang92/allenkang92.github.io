(function() {
  'use strict';

  function initProjectGallery() {
    const modal = document.getElementById('gallery-modal');
    const modalImg = document.getElementById('modal-image');
    const captionText = document.getElementById('modal-caption');
    const closeButton = modal?.querySelector('.modal-close');
    if (!modal || !modalImg || !captionText || !closeButton) return;

    function closeGalleryModal() {
      modal.hidden = true;
      modalImg.removeAttribute('src');
      modalImg.alt = '';
      captionText.textContent = '';
    }

    function openGalleryModal(img) {
      const caption = img.nextElementSibling;
      modal.hidden = false;
      modalImg.src = img.currentSrc || img.src;
      modalImg.alt = img.alt || '';
      captionText.textContent = caption ? caption.textContent : '';
      closeButton.focus();
    }

    document.querySelectorAll('[data-gallery-item]').forEach(img => {
      img.addEventListener('click', () => openGalleryModal(img));
      img.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openGalleryModal(img);
      });
      img.tabIndex = 0;
    });

    closeButton.addEventListener('click', closeGalleryModal);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeGalleryModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) closeGalleryModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectGallery);
  } else {
    initProjectGallery();
  }
})();
