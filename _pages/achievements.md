---
layout: default
title: Achievements
permalink: /achievements/
styles:
  - /assets/css/pages/achievements.css
---

<div class="achievements">
  <h1>🏆 Achievements</h1>

  <h2>🎓 Education</h2>
  <ul>
    <li>
      <strong>연세대학교 인지과학 협동과정 석사과정 (2024.03 ~ )</strong>
      <p>인공지능 및 뇌과학 연구</p>
      <p>지도교수: 김진석 교수님</p>
    </li>
    <li>
      <strong>서강대학교 물리학과 (2012.03 ~ 2019.02)</strong>
      <p>학점: 3.89/4.5</p>
      <p>물리학 전공</p>
      <p>컴퓨터공학 부전공</p>
    </li>
  </ul>

  <h2>💼 Work Experience</h2>
  <ul>
    <li>
      <strong>삼성전자 무선사업부 (2019.01 ~ 2023.12)</strong>
      <p>Android Framework Engineer</p>
      <p>Camera Framework 개발</p>
      <p>System Performance 최적화</p>
    </li>
  </ul>

  <h2>🏅 Awards & Certifications</h2>
  <ul>
    <li>
      <strong>정보처리기사</strong> (2018)
    </li>
    <li>
      <strong>TOEIC 960</strong> (2018)
    </li>
    <li>
      <strong>물리학과 학술제 대상</strong> (2018)
      <p>주제: "양자컴퓨터의 원리와 응용"</p>
    </li>
  </ul>

  <h2>💻 Projects</h2>
  <ul>
    <li>
      <strong>개인 블로그 개발</strong> (2023.12 ~ )
      <p>Jekyll 기반 정적 웹사이트 개발</p>
      <p>물리학, 인공지능, 뇌과학 관련 컨텐츠 제작</p>
    </li>
    <li>
      <strong>카메라 프레임워크 개발</strong> (2019 ~ 2023)
      <p>Android Camera HAL3 구현</p>
      <p>Camera Performance 최적화</p>
      <p>Multi-Camera 기능 개발</p>
    </li>
  </ul>

  <h2>🛠 Skills</h2>
  <h3>Programming Languages</h3>
  <ul>
    <li>Python</li>
    <li>Java</li>
    <li>C/C++</li>
    <li>JavaScript</li>
  </ul>

  <h3>Frameworks & Tools</h3>
  <ul>
    <li>Android Framework</li>
    <li>TensorFlow</li>
    <li>PyTorch</li>
    <li>Git</li>
  </ul>

  <h3>Areas of Interest</h3>
  <ul>
    <li>인공지능</li>
    <li>뇌과학</li>
    <li>양자컴퓨팅</li>
    <li>시스템 최적화</li>
  </ul>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const items = document.querySelectorAll('.achievements li');
  items.forEach((item, index) => {
    item.style.setProperty('--item-index', index);
  });
});
</script>
