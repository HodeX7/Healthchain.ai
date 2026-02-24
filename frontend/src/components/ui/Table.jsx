import React from 'react';

export function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm text-left text-slate-600">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }) {
  return (
    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHead({ children, className = '' }) {
  return (
    <th scope="col" className={`px-6 py-3 font-medium tracking-wider ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children }) {
  return (
    <tbody className="divide-y divide-slate-100">
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '' }) {
  return (
    <tr className={`hover:bg-slate-50/50 transition-colors ${className}`}>
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
