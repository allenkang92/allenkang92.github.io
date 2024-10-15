import React from 'react';

const Card = ({ children, className }) => {
  return (
    <div className={`border border-gray-300 rounded-lg shadow-md ${className}`}>
      {children}
    </div>
  );
};

const CardHeader = ({ children }) => {
  return (
    <div className="p-4 border-b border-gray-200">
      {children}
    </div>
  );
};

const CardTitle = ({ children }) => {
  return (
    <h2 className="text-xl font-bold">
      {children}
    </h2>
  );
};

const CardContent = ({ children }) => {
  return (
    <div className="p-4">
      {children}
    </div>
  );
};

export { Card, CardHeader, CardTitle, CardContent };
