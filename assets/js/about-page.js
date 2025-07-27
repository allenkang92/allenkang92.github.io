// About 페이지 전용 JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Chart.js 라이브러리 확인
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    return;
  }

  // 스킬 데이터 정의
  const skillData = {
    labels: [
      'Data Engineering',
      'Machine Learning',
      'Web Development',
      'Research',
      'Problem Solving',
      'Communication'
    ],
    datasets: [{
      label: 'Skill Level',
      data: [85, 75, 80, 90, 88, 85],
      backgroundColor: 'rgba(168, 225, 219, 0.2)',
      borderColor: 'rgba(168, 225, 219, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(168, 225, 219, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(168, 225, 219, 1)'
    }]
  };

  // Chart.js 레이더 차트 설정
  const config = {
    type: 'radar',
    data: skillData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  };

  // 차트 생성
  const ctx = document.getElementById('skillRadarChart');
  if (ctx) {
    new Chart(ctx, config);
  }

  // 탭 기능 구현
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // 모든 탭 버튼에서 active 클래스 제거
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // 클릭된 버튼에 active 클래스 추가
      this.classList.add('active');
      
      // 탭 콘텐츠 표시/숨김 로직 (필요시 추가)
      console.log('탭 전환:', targetTab);
    });
  });
});
