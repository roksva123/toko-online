import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Breadcrumb({ items, className, ...props }) {
    return (_jsx("ol", { className: cn('flex items-center gap-2 text-sm', className), ...props, children: items.map((item, index) => (_jsxs("li", { className: "flex items-center gap-2", children: [item.href && !item.isActive ? (_jsx("a", { href: item.href, className: "text-primary-600 hover:text-primary-700", children: item.label })) : (_jsx("span", { className: item.isActive ? 'text-gray-900 font-medium' : 'text-gray-600', children: item.label })), index < items.length - 1 && (_jsx("span", { className: "text-gray-400", children: "/" }))] }, index))) }));
}
//# sourceMappingURL=Breadcrumb.js.map