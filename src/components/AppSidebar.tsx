import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, ChevronDown, Users, UserCog, Send, FolderTree, Box, Wallet, Layers, Receipt, FileText, LayoutDashboard, Inbox, KeyRound, PanelLeftClose, PanelLeftOpen, Search, Lightbulb, CreditCard, Settings, Share2 } from "lucide-react";
import { AccountMenu } from "@/components/account/AccountMenu";
import { useSidebarBadge } from "@/lib/inbox-store";

type Leaf = { label: string; to: string; icon?: typeof Users };
type Group = { label: string; to?: string; icon?: typeof Users; divider?: boolean; children: (Leaf | Group)[] };
type Root = { label: string; icon: typeof ShieldCheck; children: Group[] };

/** 侧边栏合拢态下展示的分组图标 */
const groupIcons: Record<string, typeof Users> = {
  客户发现: Lightbulb,
  客户运营: Share2,
  费用中心: CreditCard,
  企业设置: Settings,
};


const menu: Root[] = [
  {
    label: "出海大数据平台",
    icon: Send,
    children: [
      {
        label: "客户发现",
        children: [
          { label: "商机线索", to: "/outreach/search" },
          { label: "企业名录", to: "/outreach/enterprise" },
          { label: "商品目录", to: "/outreach/products" },
          { label: "浏览足迹", to: "/outreach/footprints" },
        ],
      },
      {
        label: "客户运营",
        children: [
          { label: "我的收藏", to: "/outreach/favorites" },
          { label: "自建名单", to: "/outreach/manual-lists" },
          { label: "外呼话术", to: "/outreach/voice-scripts" },
          { label: "触达任务", to: "/outreach/reach" },
          { label: "触达会话", to: "/outreach/conversations" },
        ],
      },


      {
        label: "费用中心",
        children: [
          { label: "消费明细", to: "/outreach/billing" },
          { label: "账户充值", to: "/outreach/recharge" },
          { label: "发票管理", to: "/outreach/invoices" },
        ],
      },
      {
        label: "企业设置",
        children: [
          { label: "企业信息", to: "/outreach/my-profile" },
          { label: "员工管理", to: "/outreach/users" },
          { label: "社媒账号", to: "/outreach/social/accounts" },
          { label: "发信邮箱", to: "/outreach/mailboxes" },
          { label: "人工坐席", to: "/outreach/agents" },
          { label: "退订名单", to: "/outreach/suppressions" },
        ],

      },
    ],
  },
  {
    label: "管理后台",
    icon: ShieldCheck,
    children: [
      { label: "邮件托管运营", to: "/outreach/admin/managed-email", children: [] },
      { label: "邮件服务商", to: "/outreach/admin/email-providers", children: [] },
      { label: "邮件账号", to: "/outreach/admin/email-accounts", children: [] },
      { label: "短信服务商", to: "/outreach/admin/sms-providers", children: [] },
      { label: "短信路由", to: "/outreach/admin/sms-routing", children: [] },
      { label: "短信模板", to: "/outreach/admin/sms-templates", children: [] },
      { label: "外呼话术模板", to: "/outreach/admin/voice-templates", children: [] },
      { label: "发票审核", to: "/outreach/admin/invoice-review", children: [] },
      { label: "数据反馈审核", to: "/outreach/admin/data-feedback", children: [] },
      { label: "数据与合规", to: "/outreach/compliance", children: [] },

    ],
  },
];

export function AppSidebar() {
  const { location } = useRouterState();
  const badge = useSidebarBadge();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [open, setOpen] = useState<Record<string, boolean>>({
    出海大数据平台: true,
    客户发现: true,
    客户运营: true,
    管理后台: true,
  });
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    const rail: { label: string; to: string; icon: typeof Users }[] = [
      { label: "商机线索", to: "/outreach/search", icon: Search },
      ...menu[0].children.map((g) => ({
        label: g.label,
        to: g.to ?? g.children[0]?.to ?? "/outreach/search",
        icon: groupIcons[g.label] ?? FolderTree,
      })),
      { label: "管理后台", to: menu[1].children[0]?.to ?? "/outreach/search", icon: ShieldCheck },
    ];
    return (
      <aside className="w-16 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col items-center">
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border w-full">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="展开菜单"
            aria-label="展开菜单"
            className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold"
          >
            B
          </button>
        </div>
        <nav className="flex-1 w-full py-3 space-y-1 flex flex-col items-center overflow-y-auto">
          {rail.map((r) => {
            const RIcon = r.icon;
            const active = location.pathname === r.to;
            return (
              <Link
                key={r.label}
                to={r.to}
                title={r.label}
                aria-label={r.label}
                className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                }`}
              >
                <RIcon className="h-4.5 w-4.5" />
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border w-full flex justify-center">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="展开菜单"
            aria-label="展开菜单"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
          B
        </div>
        <span className="font-semibold text-sidebar-foreground tracking-wide flex-1 truncate">出海大数据平台</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="合拢菜单"
          aria-label="合拢菜单"
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {menu.map((item) => {
          const Icon = item.icon;
          const isOpen = open[item.label];
          return (
            <div key={item.label}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [item.label]: !isOpen }))}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-6 space-y-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((g) => {
                    const hasKids = g.children.length > 0;
                    const gOpen = open[g.label] ?? true;
                    const gActive = g.to ? location.pathname === g.to : false;
                    const GIcon = g.icon;
                    return (
                      <div
                        key={g.label}
                        className={g.divider ? "pb-1.5 mb-1.5 border-b border-sidebar-border" : undefined}
                      >
                        {g.to ? (
                          <div className="flex items-center">
                            <Link
                              to={g.to}
                              className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                gActive
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                              }`}
                            >
                              {GIcon && <GIcon className="h-3.5 w-3.5 text-primary" />}
                              <span>{g.label}</span>
                            </Link>
                            {hasKids && (
                              <button
                                onClick={() => setOpen((s) => ({ ...s, [g.label]: !gOpen }))}
                                className="p-1 rounded hover:bg-sidebar-accent/60"
                                aria-label="toggle"
                              >
                                <ChevronDown
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                    gOpen ? "" : "-rotate-90"
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setOpen((s) => ({ ...s, [g.label]: !gOpen }))}
                            className="w-full flex items-center px-3 py-1.5 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                          >
                            <span className="flex-1 text-left">{g.label}</span>
                            {hasKids && (
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${gOpen ? "" : "-rotate-90"}`}
                              />
                            )}
                          </button>
                        )}
                        {hasKids && gOpen && (
                          <div className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                            {g.children.map((c) => {
                              if ("children" in c && c.children && c.children.length > 0) {
                                const subOpen = open[c.label] ?? true;
                                const subActive = location.pathname === c.to;
                                const SubIcon = c.icon;
                                return (
                                  <div key={c.label}>
                                    <div className="flex items-center">
                                      <Link
                                        to={c.to}
                                        className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                          subActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                                        }`}
                                      >
                                        {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                                        <span>{c.label}</span>
                                      </Link>
                                      <button
                                        onClick={() => setOpen((s) => ({ ...s, [c.label]: !subOpen }))}
                                        className="p-1 rounded hover:bg-sidebar-accent/60"
                                        aria-label="toggle"
                                      >
                                        <ChevronDown
                                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                            subOpen ? "" : "-rotate-90"
                                          }`}
                                        />
                                      </button>
                                    </div>
                                    {subOpen && (
                                      <div className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                                        {c.children.map((leaf) => {
                                          const LI = leaf.icon;
                                          const leafActive = location.pathname === leaf.to;
                                          return (
                                            <Link
                                              key={leaf.to}
                                              to={leaf.to}
                                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                                leafActive
                                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                                              }`}
                                            >
                                              {LI && <LI className="h-3.5 w-3.5" />}
                                              <span>{leaf.label}</span>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              const CI = c.icon;
                              const active = location.pathname === c.to;
                              return (
                                <Link
                                  key={c.to}
                                  to={c.to}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                    active
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                                  }`}
                                >
                                  {CI && <CI className="h-3.5 w-3.5" />}
                                  <span>{c.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <AccountMenu />
        <div className="px-3 text-[10px] text-muted-foreground/70 tracking-wide">v1.0.0</div>
      </div>
    </aside>
  );
}