const MolecularWeightCalculator = () => {
    const [formula, setFormula] = React.useState('');
    const [result, setResult] = React.useState('');
  
    const calculateMolecularWeight = () => {
      // 계산 로직 구현
      setResult('계산된 분자량: XX g/mol');
    };
  
    return (
      <div>
        <input
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="Enter chemical formula"
        />
        <button onClick={calculateMolecularWeight}>Calculate</button>
        {result && <p>{result}</p>}
      </div>
    );
  };
  
  ReactDOM.render(<MolecularWeightCalculator />, document.getElementById('calculator'));