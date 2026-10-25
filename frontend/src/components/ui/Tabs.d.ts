import { ReactNode } from 'react';
interface TabItem {
    id: string;
    label: string;
    content: ReactNode;
}
interface TabsProps {
    tabs: TabItem[];
    defaultTab?: string;
    onChange?: (tabId: string) => void;
}
export declare function Tabs({ tabs, defaultTab, onChange }: TabsProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Tabs.d.ts.map