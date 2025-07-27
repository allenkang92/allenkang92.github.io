// About 페이지 전용 JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Chart.js 라이브러리 확인
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    return;
  }

  // 스킬 데이터 정의 (기존 데이터 복원)
  const skillData = {
    labels: [
      'Data Analysis & Science',
      'Interdisciplinary Research', 
      'Science Communication',
      'Databases',
      'Data Processing',
      'Programming Languages',
      'MLOps',
      'Scientific Knowledge'
    ],
    datasets: [{
      label: 'Skills',
      data: [85, 80, 75, 70, 65, 60, 70, 85],
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

  // About 페이지 초기화 완료
  console.log('About 페이지 레이더 차트 초기화 완료');
});
