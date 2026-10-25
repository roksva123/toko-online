import { HTMLAttributes } from 'react';
interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'bordered';
}
export declare function Card({ variant, className, ...props }: CardProps): import("react").JSX.Element;
export declare function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export {};
//# sourceMappingURL=Card.d.ts.map