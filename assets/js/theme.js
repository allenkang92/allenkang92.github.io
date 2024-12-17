// 다크모드 감지 및 라이트모드 강제 적용
class ThemeManager {
  constructor() {
    this.init();
  }

  init() {
    // 다크모드 감지
    this.darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 초기 테마 설정
    this.setLightMode();
    
    // 시스템 테마 변경 감지
    this.darkModeMediaQuery.addListener(() => {
      this.setLightMode();
    });
  }

  setLightMode() {
    document.documentElement.style.setProperty('color-scheme', 'light');
    document.body.style.backgroundColor = '#FFFFFF';
    document.body.style.color = '#000000';
  }
}

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
  window.themeManager = new ThemeManager();
});
