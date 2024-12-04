// 이미지 로딩 최적화
class ImageLoader {
  constructor() {
    this.init();
  }

  init() {
    // Intersection Observer 설정
    const options = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, options);

    // 이미지 관찰 시작
    this.observeImages();
  }

  observeImages() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => this.observer.observe(img));
  }

  loadImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) return;

    img.src = src;
    img.addEventListener('load', () => {
      img.classList.add('loaded');
    });
    img.removeAttribute('data-src');
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.imageLoader = new ImageLoader();
});
