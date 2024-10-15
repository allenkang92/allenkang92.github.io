import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

const Tabs = ({ defaultValue, children, className }) => {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} className={className}>
      {children}
    </TabsPrimitive.Root>
  );
};

const TabsList = ({ children, className }) => {
  return (
    <TabsPrimitive.List className={className}>
      {children}
    </TabsPrimitive.List>
  );
};

const TabsTrigger = ({ value, children }) => {
  return (
    <TabsPrimitive.Trigger value={value}>
      {children}
    </TabsPrimitive.Trigger>
  );
};

const TabsContent = ({ value, children }) => {
  return (
    <TabsPrimitive.Content value={value}>
      {children}
    </TabsPrimitive.Content>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
