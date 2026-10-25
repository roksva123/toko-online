import { HTMLAttributes } from 'react';
interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    maxVisible?: number;
}
export declare function Pagination({ currentPage, totalPages, onPageChange, maxVisible, className, ...props }: PaginationProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Pagination.d.ts.map