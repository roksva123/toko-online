import { HTMLAttributes } from 'react';
interface BreadcrumbItem {
    label: string;
    href?: string;
    isActive?: boolean;
}
interface BreadcrumbProps extends HTMLAttributes<HTMLOListElement> {
    items: BreadcrumbItem[];
}
export declare function Breadcrumb({ items, className, ...props }: BreadcrumbProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Breadcrumb.d.ts.map