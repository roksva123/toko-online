import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
export const Checkbox = forwardRef(({ label, className, ...props }, ref) => {
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { ref: ref, type: "checkbox", className: cn('w-4 h-4 border border-gray-300 rounded text-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer', className), ...props }), label && (_jsx("label", { className: "text-sm text-gray-700 cursor-pointer", children: label }))] }));
});
Checkbox.displayName = 'Checkbox';
//# sourceMappingURL=Checkbox.js.map