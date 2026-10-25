import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function QuantityStepper({ value, onChange, min = 1, max = 999, disabled = false, className, ...props }) {
    const handleDecrement = () => {
        if (value > min && !disabled) {
            onChange(value - 1);
        }
    };
    const handleIncrement = () => {
        if (value < max && !disabled) {
            onChange(value + 1);
        }
    };
    const handleInputChange = (e) => {
        const newValue = parseInt(e.target.value) || min;
        if (newValue >= min && newValue <= max && !disabled) {
            onChange(newValue);
        }
    };
    return (_jsxs("div", { className: cn('flex items-center border border-gray-300 rounded w-fit', disabled && 'opacity-50 cursor-not-allowed', className), ...props, children: [_jsx("button", { onClick: handleDecrement, disabled: value <= min || disabled, className: "px-3 py-2 hover:bg-gray-50 disabled:hover:bg-transparent disabled:cursor-not-allowed", "aria-label": "Kurangi jumlah", children: "\u2212" }), _jsx("input", { type: "number", value: value, onChange: handleInputChange, disabled: disabled, min: min, max: max, className: "w-12 text-center border-0 outline-none" }), _jsx("button", { onClick: handleIncrement, disabled: value >= max || disabled, className: "px-3 py-2 hover:bg-gray-50 disabled:hover:bg-transparent disabled:cursor-not-allowed", "aria-label": "Tambah jumlah", children: "+" })] }));
}
//# sourceMappingURL=QuantityStepper.js.map