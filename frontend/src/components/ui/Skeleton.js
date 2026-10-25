import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Skeleton({ className, count = 1 }) {
    return (_jsx(_Fragment, { children: Array.from({ length: count }).map((_, i) => (_jsx("div", { className: cn('bg-gray-200 rounded animate-pulse', className) }, i))) }));
}
export function CardSkeleton() {
    return (_jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsx(Skeleton, { className: "w-full h-48" }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-1/2" }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Skeleton, { className: "h-8 w-20" }), _jsx(Skeleton, { className: "h-8 w-20" })] })] })] }));
}
export function ProductGridSkeleton() {
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: Array.from({ length: 8 }).map((_, i) => (_jsx(CardSkeleton, {}, i))) }));
}
//# sourceMappingURL=Skeleton.js.map