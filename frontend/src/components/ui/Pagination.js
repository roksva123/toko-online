import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Pagination({ currentPage, totalPages, onPageChange, maxVisible = 5, className, ...props }) {
    const getPageNumbers = () => {
        const pages = [];
        const halfVisible = Math.floor(maxVisible / 2);
        let start = Math.max(1, currentPage - halfVisible);
        let end = Math.min(totalPages, currentPage + halfVisible);
        if (start > 1) {
            pages.push(1);
            if (start > 2)
                pages.push('...');
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        if (end < totalPages) {
            if (end < totalPages - 1)
                pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };
    const pages = getPageNumbers();
    return (_jsxs("div", { className: cn('flex items-center justify-center gap-1', className), ...props, children: [_jsx("button", { onClick: () => onPageChange(Math.max(1, currentPage - 1)), disabled: currentPage === 1, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Sebelumnya" }), pages.map((page, idx) => (_jsx("button", { onClick: () => typeof page === 'number' && onPageChange(page), disabled: page === '...', className: cn('px-3 py-2 rounded border', page === currentPage
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 hover:bg-gray-50', page === '...' && 'cursor-default hover:bg-white'), children: page }, idx))), _jsx("button", { onClick: () => onPageChange(Math.min(totalPages, currentPage + 1)), disabled: currentPage === totalPages, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Selanjutnya" })] }));
}
//# sourceMappingURL=Pagination.js.map