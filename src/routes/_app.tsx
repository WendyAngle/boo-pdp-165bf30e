import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShieldCheck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { useCertification, type CertStatus } from "@/lib/certification";
import { cn } from "@/lib/utils";
import { ENTERPRISES } from "@/data/enterprises";
import { seedFeedbackDemoIfEmpty } from "@/lib/data-feedback";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  // 演示数据：数据反馈工单及其采纳奖励流水（全站初始化，避免仅在后台页生成）
  useEffect(() => {
    seedFeedbackDemoIfEmpty(
      ENTERPRISES.slice(0, 3).map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        website: e.website,
        contactName: e.contacts[0]?.name,
      })),
    );
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>

      </main>
    </div>
  );
}

function TopBar() {
  const cert = useCertification();
  const status: CertStatus = cert.status;

  return (
    <header className="h-12 shrink-0 sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar/80 backdrop-blur px-4 lg:px-6">
      <span className="text-sm text-muted-foreground truncate">
        出海大数据平台 · 企业身份核验中心
      </span>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            status === "unverified"
              ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
              : status === "pending"
                ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          )}
          aria-label="企业实名认证"
        >
          {status === "unverified" && <AlertTriangle className="h-4 w-4" />}
          {status === "pending" && <Clock className="h-4 w-4" />}
          {status === "verified" && <ShieldCheck className="h-4 w-4" />}
          {status === "unverified" ? "去认证" : status === "pending" ? "认证审核中" : "已认证"}
        </button>
        {status === "verified" && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="已认证" />
        )}
      </div>
    </header>
  );
}
