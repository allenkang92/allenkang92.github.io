---
layout: default
title: Tools
permalink: /tools/
---

# Tools & Resources

<div class="tools-container">
  <div class="tool-card">
    <h2>Calculator</h2>
    <div class="calculator-container">
      <div class="tab-container" role="tablist" aria-label="Calculator Types">
        <button class="tab-button active" role="tab" aria-selected="true" aria-controls="basic-calculator" id="basic-tab" onclick="switchTab('basic')">Basic Calculator</button>
        <button class="tab-button" role="tab" aria-selected="false" aria-controls="physics-calculator" id="physics-tab" onclick="switchTab('physics')">Physics Calculator</button>
        <button class="tab-button" role="tab" aria-selected="false" aria-controls="unit-calculator" id="unit-tab" onclick="switchTab('unit')">Unit Converter</button>
      </div>

      <div id="basic-calculator" class="calculator-tab active" role="tabpanel" aria-labelledby="basic-tab">
        <div class="calculator" role="application" aria-label="Basic Calculator">
          <div class="calculator-display" role="textbox" aria-live="polite" aria-atomic="true">
            <div class="previous-operand" aria-label="Previous calculation"></div>
            <div class="current-operand" aria-label="Current input"></div>
          </div>
          
          <div class="calculator-grid">
            <button class="span-two" data-action="clear" aria-label="Clear all">AC</button>
            <button data-action="delete" aria-label="Delete last input">DEL</button>
            <button data-operation="÷" aria-label="Divide">÷</button>
            
            <button data-number="7" aria-label="7">7</button>
            <button data-number="8" aria-label="8">8</button>
            <button data-number="9" aria-label="9">9</button>
            <button data-operation="×" aria-label="Multiply">×</button>
            
            <button data-number="4" aria-label="4">4</button>
            <button data-number="5" aria-label="5">5</button>
            <button data-number="6" aria-label="6">6</button>
            <button data-operation="-" aria-label="Subtract">-</button>
            
            <button data-number="1" aria-label="1">1</button>
            <button data-number="2" aria-label="2">2</button>
            <button data-number="3" aria-label="3">3</button>
            <button data-operation="+" aria-label="Add">+</button>
            
            <button data-number="0" aria-label="0">0</button>
            <button data-number="." aria-label="Decimal point">.</button>
            <button class="span-two" data-equals aria-label="Calculate">=</button>
          </div>

          <div class="calculator-error" role="alert" aria-live="assertive" style="display: none;">
            An error occurred. Please check your input.
          </div>
        </div>
      </div>

      <div id="physics-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="physics-tab" hidden>
        <div class="physics-calculator">
          <h2>Physics Calculator</h2>
          
          <div class="form-group">
            <label for="physics-formula">Select Physics Formula:</label>
            <select id="physics-formula" onchange="updatePhysicsInputs()" aria-label="Select formula">
              <option value="">Select Formula</option>
              <option value="velocity">Velocity (v = d/t)</option>
              <option value="acceleration">Acceleration (a = Δv/t)</option>
              <option value="force">Force (F = ma)</option>
              <option value="kinetic">Kinetic Energy (K = ½mv²)</option>
              <option value="potential">Potential Energy (U = mgh)</option>
            </select>
          </div>

          <div id="physics-inputs" role="group" aria-label="Physics inputs"></div>
          <div id="physics-formula-display" class="formula" aria-live="polite"></div>
          <button onclick="calculatePhysics()" aria-label="Calculate">Calculate</button>
          <div id="physics-result" class="result" aria-live="polite"></div>
        </div>
      </div>

      <div id="unit-calculator" class="calculator-tab" role="tabpanel" aria-labelledby="unit-tab" hidden>
        <div class="unit-converter">
          <h2>Unit Converter</h2>
          
          <div class="converter-form">
            <div class="form-group">
              <label for="unit-category">Unit Category:</label>
              <select id="unit-category" onchange="updateUnitOptions()" aria-label="Select unit category">
                <option value="">Select Category</option>
              </select>
            </div>

            <div class="form-group">
              <label for="unit-value">Value:</label>
              <input type="number" id="unit-value" placeholder="Enter value" aria-label="Enter value" />
            </div>

            <div class="conversion-units">
              <div class="form-group">
                <label for="from-unit">From:</label>
                <select id="from-unit" aria-label="Convert from">
                  <option value="">Select Unit</option>
                </select>
              </div>

              <div class="arrow" aria-hidden="true">→</div>

              <div class="form-group">
                <label for="to-unit">To:</label>
                <select id="to-unit" aria-label="Convert to">
                  <option value="">Select Unit</option>
                </select>
              </div>
            </div>

            <button onclick="performConversion()" class="convert-button" aria-label="Convert">Convert</button>
            <div id="unit-result" class="result" aria-live="polite"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
