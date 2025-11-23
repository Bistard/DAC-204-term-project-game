
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'success';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', disabled, ...props }) => {
  const baseStyles = "px-4 py-2 font-bold uppercase tracking-widest text-xl sm:text-2xl transition-all active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed pixel-corners relative border-b-4 border-r-4 active:border-b-0 active:border-r-0 active:translate-x-[2px] active:translate-y-[2px] western-font shadow-lg";
  
  const variants = {
    primary: "bg-amber-700 text-amber-100 border-amber-900 hover:bg-amber-600 shadow-[0_4px_0_rgb(69,26,3)]",
    danger: "bg-red-800 text-red-100 border-red-950 hover:bg-red-700 shadow-[0_4px_0_rgb(69,10,10)]",
    secondary: "bg-stone-600 text-stone-200 border-stone-800 hover:bg-stone-500 shadow-[0_4px_0_rgb(41,37,36)]",
    success: "bg-emerald-800 text-emerald-100 border-emerald-950 hover:bg-emerald-700 shadow-[0_4px_0_rgb(2,44,34)]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
