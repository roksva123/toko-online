import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
};
export function Modal({ isOpen, onClose, title, children, footer, size = 'md', }) {
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: onClose, children: _jsxs("div", { className: cn('bg-white rounded-lg shadow-xl', sizeStyles[size]), onClick: (e) => e.stopPropagation(), children: [title && (_jsxs("div", { className: "px-6 py-4 border-b border-gray-100 flex justify-between items-center", children: [_jsx("h2", { className: "text-lg font-semibold", children: title }), _jsx("button", { onClick: onClose, className: "text-gray-500 hover:text-gray-700 text-xl", children: "\u2715" })] })), _jsx("div", { className: "px-6 py-4", children: children }), footer && (_jsx("div", { className: "px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2", children: footer }))] }) }));
}
//# sourceMappingURL=Modal.js.map