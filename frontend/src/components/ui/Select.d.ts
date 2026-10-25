import { SelectHTMLAttributes } from 'react';
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: {
        value: string;
        label: string;
    }[];
}
export declare const Select: import("react").ForwardRefExoticComponent<SelectProps & import("react").RefAttributes<HTMLSelectElement>>;
export {};
//# sourceMappingURL=Select.d.ts.map