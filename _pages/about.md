---
layout: default
title: About
permalink: /about/
---

{% include_relative about_me_all.md %}

<!-- 탭 네비게이션 -->
<div class="about-tabs">
  <div class="tab-buttons">
    <button class="tab-button active" data-tab="knowledge-domains">Knowledge Domains</button>
    <button class="tab-button" data-tab="tech-stack">Tech Stack</button>
    <button class="tab-button" data-tab="all">All</button>
  </div>

  <!-- 스킬 레이더 차트 -->
  <div class="radar-chart-container">
    <canvas id="skillRadarChart" width="400" height="400"></canvas>
  </div>
</div>

<!-- Chart.js 라이브러리 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // Chart.js 라이브러리 확인
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    return;
  }

  // 스킬 데이터
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
</script>
