import { Mountain } from 'lucide-react';

interface Props {
    timeText: string;
}

export default function DashboardHeader({ timeText }: Props) {
    return (
        <>
            <header>
                <div className="brand">
                    <div className="brand-mark">
                        <Mountain size={25} />
                    </div>
                    <div>
                        <strong>
                            方向图 <span>Mypattern</span>
                        </strong>
                        <small>矿区三维运行中心</small>
                    </div>
                </div>
                <div className="header-status">
                    <i />
                    模拟运行中 <span className="divider" />
                    2026.09.10 <b>{timeText}</b>
                    <div className="avatar">方</div>
                </div>
            </header>
        </>
    );
}
