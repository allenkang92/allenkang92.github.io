---
layout: default
title: Tools
permalink: /tools/
scripts:
  - /assets/js/tools.js
---

# Lab Instruments / 실험 도구

<p class="tools-intro">계산기는 이 페이지에서 바로 사용할 수 있고, 자주 찾는 한국어 검색어별 공식과 예시는 개별 안내 페이지로 분리했습니다.</p>

<section class="tool-directory" aria-labelledby="tool-directory-title">
  <h2 id="tool-directory-title">개별 계산 안내</h2>
  <div class="tool-directory__grid" markdown="0">
<a class="tool-directory__item" href="/tools/unit-converter/">
<span class="tool-directory__label">단위 변환기</span>
<span class="tool-directory__desc">길이, 질량, 시간, 온도 변환 공식과 예시</span>
</a>
<a class="tool-directory__item" href="/tools/kinetic-energy-calculator/">
<span class="tool-directory__label">운동 에너지 계산기</span>
<span class="tool-directory__desc">질량과 속도로 운동 에너지를 J 단위로 계산</span>
</a>
<a class="tool-directory__item" href="/tools/acceleration-calculator/">
<span class="tool-directory__label">가속도 계산기</span>
<span class="tool-directory__desc">속도 변화량과 시간으로 평균 가속도 계산</span>
</a>
<a class="tool-directory__item tool-directory__item--pending" href="/tools/dsr-calculator/">
<span class="tool-directory__label">DSR 계산기 준비 중</span>
<span class="tool-directory__desc">총부채원리금상환비율 공식과 기준 안내</span>
</a>
  </div>
</section>

<div class="tools-container" markdown="0">
  <div class="tool-card">
    <h2>Calculator / 계산기</h2>
    <div class="calculator-container">
      <div class="tab-container" role="tablist" aria-label="Calculator Types / 계산기 종류">
        <button class="tab-button active" role="tab" aria-selected="true" aria-controls="basic-calculator" id="basic-tab" data-tab="basic">Basic Calculator / 기본 계산기</button>
        <button class="tab-button" role="tab" aria-selected="false" aria-controls="physics-calculator" id="physics-tab" data-tab="physics">Physics Calculator / 물리 계산기</button>
        <button class="tab-button" role="tab" aria-selected="false" aria-controls="unit-calculator" id="unit-tab" data-tab="unit">Unit Converter / 단위 변환기</button>
      </div>

      <div id="basic-calculator" class="calculator-tab active" role="tabpanel" aria-labelledby="basic-tab">
        <div class="calculator" role="group" aria-label="Basic Calculator / 기본 계산기" aria-describedby="calculator-error">
          <div class="calculator-display" role="status" aria-live="polite" aria-atomic="true">
            <div class="previous-operand" aria-label="Previous calculation / 이전 계산"></div>
            <div class="current-operand" aria-label="Current input / 현재 입력"></div>
          </div>
          
          <div class="calculator-grid">
            <button class="span-two" data-action="clear" aria-label="Clear all / 전체 삭제">AC <span class="key-hint">초기화</span></button>
            <button data-action="delete" aria-label="Delete last input / 마지막 입력 삭제">DEL <span class="key-hint">삭제</span></button>
            <button data-operation="÷" aria-label="Divide / 나누기">÷</button>
            
            <button data-number="7" aria-label="7">7</button>
            <button data-number="8" aria-label="8">8</button>
            <button data-number="9" aria-label="9">9</button>
            <button data-operation="×" aria-label="Multiply / 곱하기">×</button>
            
            <button data-number="4" aria-label="4">4</button>
            <button data-number="5" aria-label="5">5</button>
            <button data-number="6" aria-label="6">6</button>
            <button data-operation="-" aria-label="Subtract / 빼기">-</button>
            
            <button data-number="1" aria-label="1">1</button>
            <button data-number="2" aria-label="2">2</button>
            <button data-number="3" aria-label="3">3</button>
            <button data-operation="+" aria-label="Add / 더하기">+</button>
            
            <button data-number="0" aria-label="0">0</button>
            <button data-number="." aria-label="Decimal point / 소수점">.</button>
            <button class="span-two" data-equals aria-label="Calculate / 계산">= <span class="key-hint">계산</span></button>
          </div>

          <div id="calculator-error" class="calculator-error" role="alert" aria-live="assertive" hidden>
            Error / 오류: Please check your input. / 입력값을 확인해 주세요.
          </div>
        </div>
      </div>

      <div id="physics-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="physics-tab" hidden>
        <div class="physics-calculator">
          <h2>Physics Calculator / 물리 계산기</h2>
          
          <div class="form-group">
            <label for="physics-formula">Select Physics Formula / 물리 공식 선택:</label>
            <select id="physics-formula" aria-label="Select formula / 공식 선택">
              <option value="">Select Formula / 공식 선택</option>
              <option value="velocity">Velocity / 속도 (v = d/t)</option>
              <option value="acceleration">Acceleration / 가속도 (a = Δv/t)</option>
              <option value="force">Force / 힘 (F = ma)</option>
              <option value="kinetic">Kinetic Energy / 운동 에너지 (K = ½mv²)</option>
              <option value="potential">Potential Energy / 위치 에너지 (U = mgh)</option>
            </select>
          </div>

          <div id="physics-inputs" role="group" aria-label="Physics inputs / 물리 입력값"></div>
          <div id="physics-formula-display" class="formula" aria-live="polite"></div>
          <button id="physics-calculate" aria-label="Calculate / 계산">Calculate / 계산</button>
          <div id="physics-result" class="result" aria-live="polite"></div>
        </div>
      </div>

      <div id="unit-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="unit-tab" hidden>
        <div class="unit-converter">
          <h2>Unit Converter / 단위 변환기</h2>
          
          <div class="converter-form">
            <div class="form-group">
              <label for="unit-category">Unit Category / 단위 범주:</label>
              <select id="unit-category" aria-label="Select unit category / 단위 범주 선택">
                <option value="">Select Category / 범주 선택</option>
              </select>
            </div>

            <div class="form-group">
              <label for="unit-value">Value / 값:</label>
              <input type="number" id="unit-value" placeholder="Enter value / 값을 입력하세요" aria-label="Enter value / 값 입력" />
            </div>

            <div class="conversion-units">
              <div class="form-group">
                <label for="from-unit">From / 변환 전:</label>
                <select id="from-unit" aria-label="Convert from / 변환 전 단위">
                  <option value="">Select Unit / 단위 선택</option>
                </select>
              </div>

              <div class="arrow" aria-hidden="true">→</div>

              <div class="form-group">
                <label for="to-unit">To / 변환 후:</label>
                <select id="to-unit" aria-label="Convert to / 변환 후 단위">
                  <option value="">Select Unit / 단위 선택</option>
                </select>
              </div>
            </div>

            <button id="unit-convert" class="convert-button" aria-label="Convert / 변환">Convert / 변환</button>
            <div id="unit-result" class="result" aria-live="polite"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
