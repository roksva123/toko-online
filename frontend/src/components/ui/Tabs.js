import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { cn } from '@/lib/utils';
export function Tabs({ tabs, defaultTab, onChange }) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        onChange?.(tabId);
    };
    const activeTabContent = tabs.find((tab) => tab.id === activeTab);
    return (_jsxs("div", { children: [_jsx("div", { className: "border-b border-gray-200 flex gap-0 overflow-x-auto", children: tabs.map((tab) => (_jsx("button", { onClick: () => handleTabChange(tab.id), className: cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap', activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'), children: tab.label }, tab.id))) }), _jsx("div", { className: "pt-4", children: activeTabContent && activeTabContent.content })] }));
}
//# sourceMappingURL=Tabs.js.map