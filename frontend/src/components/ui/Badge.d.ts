import { HTMLAttributes } from 'react';
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}
export declare function Badge({ variant, className, ...props }: BadgeProps): import("react").JSX.Element;
export declare function StatusBadge({ status }: {
    status: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Badge.d.ts.map