import { ShieldCheck, ChevronRight } from "lucide-react";

interface Props {
  breadcrumb: string[];
  title: string;
  subtitle: string;
}

export function PagePlaceholder({ breadcrumb, title, subtitle }: Props) {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>{b}</span>
          </span>
        ))}
      </div>

      <section className="relative overflow-hidden rounded-2xl p-8 text-white" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-white/85 mt-1">{subtitle}</p>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-dashed bg-card p-16 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">功能建设中</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">具体功能稍后补充，敬请期待</p>
      </div>
    </div>
  );
}