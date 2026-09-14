import type { ReactNode } from 'react';
import { PanelLeftClose, Radio, Search } from 'lucide-react';

interface Tab {
    value: string;
    label: string;
    count: number;
}
interface Props {
    collapsed: boolean;
    query: string;
    filter: string;
    total: number;
    vehicleCount: number;
    personCount: number;
    tabs: Tab[];
    children: ReactNode;
    hasResults: boolean;
    onCollapsed(value: boolean): void;
    onQuery(value: string): void;
    onFilter(value: string): void;
}

/** 目标面板只提供公共框架，具体目标卡片由业务模块传入。 */
export default function TargetPanel(props: Props) {
    return (
        <aside className="left-panel panel">
            <div className="panel-title">
                <div>
                    <Radio size={16} />
                    <b>运行目标</b>
                </div>
                <button
                    title={props.collapsed ? '展开面板' : '收起面板'}
                    onClick={() => props.onCollapsed(!props.collapsed)}
                >
                    <PanelLeftClose size={16} />
                </button>
            </div>
            <div className="panel-content">
                <div className="summary">
                    <div>
                        <span>在线车辆</span>
                        <strong>
                            {String(props.vehicleCount).padStart(2, '0')}
                            <small>辆</small>
                        </strong>
                        <div className="summary-line amber" />
                    </div>
                    <div>
                        <span>在岗人员</span>
                        <strong>
                            {String(props.personCount).padStart(2, '0')}
                            <small>人</small>
                        </strong>
                        <div className="summary-line teal" />
                    </div>
                </div>
                <div className="tabs">
                    {props.tabs.map((tab) => (
                        <button
                            key={tab.value}
                            className={props.filter === tab.value ? 'active' : ''}
                            onClick={() => props.onFilter(tab.value)}
                        >
                            {tab.label}
                            <small>{tab.count}</small>
                        </button>
                    ))}
                </div>
                <label className="search">
                    <Search size={15} />
                    <input
                        placeholder="搜索姓名、车辆编号"
                        value={props.query}
                        onChange={(event) => props.onQuery(event.target.value)}
                    />
                    <kbd>⌕</kbd>
                </label>
                <div className="target-list">
                    {props.children}
                    {!props.hasResults && <p className="empty">没有匹配的运行目标</p>}
                </div>
                <div className="list-footer">
                    <i />
                    全部终端在线{' '}
                    <span>
                        {props.total} / {props.total}
                    </span>
                </div>
            </div>
        </aside>
    );
}
