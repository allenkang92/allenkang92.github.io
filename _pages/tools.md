---
layout: default
title: 도구
description: 단위 변환기, 운동 에너지 계산기, 가속도 계산기와 DSR 공식 안내를 모은 실험 도구 페이지입니다.
permalink: /tools/
scripts:
  - /assets/js/tools.js
---

<header class="tools-page-header">
  <p class="section-kicker">계산 · 변환</p>
  <h1>도구</h1>
  <p class="tools-intro">계산 종류를 고르고 값을 입력하면 결과를 바로 확인할 수 있습니다.</p>
</header>

<section class="tools-container" aria-labelledby="tool-workspace-title" markdown="0">
  <style>.calculator-container[hidden], #calculator-load-notice[hidden] { display: none !important; } #calculator-url-status:empty { margin: 0; }</style>
  <div class="tool-card">
    <div class="tool-section-heading">
      <div>
        <p class="section-kicker">바로 사용</p>
        <h2 id="tool-workspace-title">계산기</h2>
      </div>
      <p>값을 입력한 뒤 결과를 확인하세요.</p>
    </div>
    <p id="calculator-load-notice" role="status">계산기를 불러오는 중입니다. 이 안내가 계속 보이면 자바스크립트 설정을 확인하고 페이지를 새로고침해 주세요. 아래 계산 안내는 계속 볼 수 있습니다.</p>
    <div class="calculator-container" hidden>
      <div class="tab-container" role="tablist" aria-label="계산기 종류">
        <button type="button" class="tab-button active" role="tab" aria-selected="true" aria-controls="basic-calculator" id="basic-tab" data-tab="basic">일반 계산</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="physics-calculator" id="physics-tab" data-tab="physics" tabindex="-1">물리 공식</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="unit-calculator" id="unit-tab" data-tab="unit" tabindex="-1">단위 변환</button>
      </div>
      <p id="calculator-url-status" role="status" aria-live="polite" aria-atomic="true"></p>

      <div id="basic-calculator" class="calculator-tab active" role="tabpanel" aria-labelledby="basic-tab">
        <div class="calculator" role="group" aria-label="일반 계산기" aria-describedby="calculator-error">
          <div class="calculator-display" role="status" aria-live="polite" aria-atomic="true" aria-label="계산 결과">
            <div class="previous-operand-line" hidden><span class="visually-hidden">이전 계산: </span><span class="previous-operand"></span></div>
            <div><span class="visually-hidden">현재 입력: </span><span class="current-operand"></span></div>
          </div>
          
          <div class="calculator-grid">
            <button type="button" data-action="clear" aria-label="전체 초기화">AC <span class="key-hint">초기화</span></button>
            <button type="button" data-action="delete" aria-label="마지막 입력 삭제">DEL <span class="key-hint">삭제</span></button>
            <button type="button" data-action="sign" aria-label="± 부호 바꾸기">± <span class="key-hint">부호</span></button>
            <button type="button" data-operation="÷" aria-label="나누기">÷</button>
            
            <button type="button" data-number="7" aria-label="7">7</button>
            <button type="button" data-number="8" aria-label="8">8</button>
            <button type="button" data-number="9" aria-label="9">9</button>
            <button type="button" data-operation="×" aria-label="곱하기">×</button>
            
            <button type="button" data-number="4" aria-label="4">4</button>
            <button type="button" data-number="5" aria-label="5">5</button>
            <button type="button" data-number="6" aria-label="6">6</button>
            <button type="button" data-operation="-" aria-label="빼기">-</button>
            
            <button type="button" data-number="1" aria-label="1">1</button>
            <button type="button" data-number="2" aria-label="2">2</button>
            <button type="button" data-number="3" aria-label="3">3</button>
            <button type="button" data-operation="+" aria-label="더하기">+</button>
            
            <button type="button" data-number="0" aria-label="0">0</button>
            <button type="button" data-number="." aria-label="소수점">.</button>
            <button type="button" class="span-two" data-equals aria-label="계산">= <span class="key-hint">계산</span></button>
          </div>

          <p id="calculator-precision-notice" role="status" aria-live="polite" hidden></p>
          <div id="calculator-error" class="calculator-error" role="alert" aria-live="assertive" hidden>
            오류: 입력값을 확인해 주세요.
          </div>
        </div>
      </div>

      <div id="physics-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="physics-tab" hidden>
        <div class="physics-calculator">
          <h3>물리 공식 계산</h3>
          <p>입력값을 기준으로 계산하며 측정 오차는 반영하지 않습니다. 결과는 최대 유효 숫자 17자리로 표시하며 반올림한 경우 근삿값으로 안내합니다.</p>
          
          <div class="form-group">
            <label for="physics-formula">물리 공식</label>
            <select id="physics-formula">
              <option value="">공식을 선택하세요</option>
              <option value="velocity">평균 속력 (v = d/t)</option>
              <option value="acceleration">가속도 (a = Δv/t)</option>
              <option value="force">힘 (F = ma)</option>
              <option value="kinetic">운동 에너지 (K = ½mv²)</option>
              <option value="potential">위치 에너지 (U = mgh)</option>
            </select>
          </div>

          <div id="physics-inputs" role="group" aria-label="물리 입력값"></div>
          <div id="physics-formula-display" class="formula" aria-live="polite"></div>
          <button type="button" id="physics-calculate">계산하기</button>
          <div id="physics-result" class="result" role="status" aria-live="polite" aria-atomic="true"></div>
        </div>
      </div>

      <div id="unit-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="unit-tab" hidden>
        <div class="unit-converter">
          <h3>단위 변환</h3>
          
          <div class="converter-form">
            <div class="form-group">
                <label for="unit-category">변환 종류</label>
                <select id="unit-category" aria-label="변환 종류 선택">
                  <option value="">종류를 선택하세요</option>
              </select>
            </div>

            <p id="unit-temperature-guidance" hidden>실제 온도만 변환합니다. 온도 차이는 지원하지 않으며 절대 영도 미만은 입력할 수 없습니다.</p>

            <div class="form-group">
                <label for="unit-value">변환할 값</label>
                <input type="number" step="any" id="unit-value" placeholder="숫자를 입력하세요" />
            </div>

            <div class="conversion-units">
              <div class="form-group">
                <label for="from-unit">변환 전 단위</label>
                <select id="from-unit" aria-label="변환 전 단위">
                  <option value="">단위를 선택하세요</option>
                </select>
              </div>

              <div class="arrow" aria-hidden="true">→</div>

              <div class="form-group">
                <label for="to-unit">변환 후 단위</label>
                <select id="to-unit" aria-label="변환 후 단위">
                  <option value="">단위를 선택하세요</option>
                </select>
              </div>
            </div>

            <button type="button" id="unit-convert" class="convert-button">변환하기</button>
            <div id="unit-result" class="result" role="status" aria-live="polite" aria-atomic="true"></div>
            <p>결과에 측정 오차는 반영되지 않습니다.</p>
            <details>
              <summary>결과 표시 기준</summary>
              <p>다른 단위로 변환한 결과는 최대 유효 숫자 17자리로 표시하며 반올림한 경우 근삿값으로 안내합니다. 같은 단위는 입력값을 그대로 표시합니다.</p>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="tool-directory" aria-labelledby="tool-directory-title" markdown="0">
  <div class="tool-section-heading">
    <div>
      <p class="section-kicker">공식과 예시</p>
      <h2 id="tool-directory-title">계산 안내</h2>
    </div>
    <p>계산 원리와 입력 방법을 확인할 수 있습니다.</p>
  </div>
  <div class="tool-directory__grid" markdown="0">
{% for tool in site.data.tools.items %}
<a class="tool-directory__item{% if tool.status == 'pending' %} tool-directory__item--pending{% endif %}" href="{{ tool.url | relative_url }}">
<span class="tool-directory__copy"><span class="tool-directory__label">{{ tool.title }}</span><span class="tool-directory__desc">{{ tool.description }}</span></span>
<span class="tool-directory__status">{% if tool.status == 'pending' %}준비 중{% else %}안내 보기{% endif %}</span>
</a>
{% endfor %}
  </div>
</section>
