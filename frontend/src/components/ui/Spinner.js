import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Spinner({ fullscreen = false }) {
    const content = (_jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-primary-600 rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-4 h-4 bg-primary-600 rounded-full animate-bounce", style: { animationDelay: '150ms' } }), _jsx("div", { className: "w-4 h-4 bg-primary-600 rounded-full animate-bounce", style: { animationDelay: '300ms' } })] }));
    if (fullscreen) {
        return (_jsx("div", { className: "fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm", children: content }));
    }
    return content;
}
//# sourceMappingURL=Spinner.js.map