import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
export const Select = forwardRef(({ label, error, options, className, ...props }, ref) => {
    return (_jsxs("div", { className: "w-full", children: [label && (_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: label })), _jsxs("select", { ref: ref, className: cn('w-full px-3 py-2.5 border border-gray-300 rounded text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed', error && 'border-red-500 focus-visible:outline-red-500', className), ...props, children: [_jsx("option", { value: "", children: "Pilih..." }), options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value)))] }), error && _jsx("p", { className: "text-sm text-red-600 mt-1", children: error })] }));
});
Select.displayName = 'Select';
//# sourceMappingURL=Select.js.map