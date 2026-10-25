import { ButtonHTMLAttributes } from 'react';
interface QuantityStepperProps extends ButtonHTMLAttributes<HTMLDivElement> {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
}
export declare function QuantityStepper({ value, onChange, min, max, disabled, className, ...props }: QuantityStepperProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=QuantityStepper.d.ts.map