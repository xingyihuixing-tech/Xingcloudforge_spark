import React, { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  collapsible?: boolean;
}

const Panel: React.FC<PanelProps> = ({ children, className = '', title, collapsible = false }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className={`bg-black/70 backdrop-blur-md border border-white/10 rounded-lg p-4 text-white shadow-xl ${className}`}>
      {title && (
        <div 
          className={`flex justify-between items-center mb-4 ${collapsible ? 'cursor-pointer' : ''}`}
          onClick={() => collapsible && setIsOpen(!isOpen)}
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-200/80">{title}</h2>
          {collapsible && (
            <span className="text-xs text-white/50">{isOpen ? '−' : '+'}</span>
          )}
        </div>
      )}
      
      {(!collapsible || isOpen) && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default Panel;