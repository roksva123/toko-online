import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function Card({ variant = 'default', className, ...props }) {
    return (_jsx("div", { className: cn('rounded-lg overflow-hidden', variant === 'default' && 'bg-white shadow-md', variant === 'bordered' && 'border border-gray-200 bg-white', className), ...props }));
}
export function CardHeader({ className, ...props }) {
    return _jsx("div", { className: cn('px-6 py-4 border-b border-gray-100', className), ...props });
}
export function CardBody({ className, ...props }) {
    return _jsx("div", { className: cn('px-6 py-4', className), ...props });
}
export function CardFooter({ className, ...props }) {
    return (_jsx("div", { className: cn('px-6 py-4 border-t border-gray-100 bg-gray-50', className), ...props }));
}
//# sourceMappingURL=Card.js.map