import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function EmptyState({ icon, title, description, action, }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 px-4 text-center", children: [icon && _jsx("div", { className: "text-5xl mb-4 opacity-50", children: icon }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: title }), _jsx("p", { className: "text-gray-600 mb-6 max-w-sm", children: description }), action && _jsx("div", { children: action })] }));
}
//# sourceMappingURL=EmptyState.js.map